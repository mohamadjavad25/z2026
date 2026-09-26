import { Pool } from "pg";
import { applySchema } from "./schema.js";

/**
 * Vercel's Postgres/Supabase integration sets POSTGRES_URL (pooled, via
 * PgBouncer/Supavisor in transaction mode) and POSTGRES_URL_NON_POOLING
 * (direct connection). We prefer the NON-pooling/direct URL: the `pg`
 * package issues every parameterized query as an extended-protocol
 * (prepared) statement, and PgBouncer's transaction-pooling mode hands out
 * a different physical server connection per transaction, which breaks
 * server-side prepared statements ("prepared statement ... does not
 * exist" or similar opaque failures) -- this is exactly what was causing
 * every write (e.g. registration) to fail after switching this project
 * from SQLite to Supabase Postgres. A serverless function's connection
 * lifetime is short, so a direct connection per invocation is fine; it
 * just doesn't share a pool of already-open TCP connections the way
 * PgBouncer does. DATABASE_URL is accepted as a common fallback name so
 * this also works against a plain self-hosted Postgres.
 */
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "";

let pool = null;

function getPool() {
  if (pool) return pool;
  if (!connectionString) {
    throw new Error(
      "No Postgres connection string configured. Set POSTGRES_URL (or POSTGRES_URL_NON_POOLING / DATABASE_URL) in the environment."
    );
  }
  pool = new Pool({
    connectionString,
    // Most managed Postgres (Neon/Vercel Postgres included) requires TLS and
    // presents a certificate that isn't in Node's default trust store in
    // every environment; rejectUnauthorized:false matches what Vercel's own
    // Postgres quickstart snippets use. This can be tightened with a real
    // CA bundle later if desired.
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false }
  });
  return pool;
}

/**
 * A `runner` throughout app/lib/db/repos/*.js is anything exposing an async
 * `.query(text, params)` -- either the pool itself (getDb()) or a single
 * checked-out client (inside withTransaction). Repo functions accept an
 * optional runner as their last argument so a caller that already holds an
 * open transaction can thread its client through instead of picking a new,
 * unrelated pooled connection mid-transaction.
 */

/** Converts this codebase's sqlite-style `?` positional placeholders (each
 *  `?` consumes the next value in `params`, left to right -- verified: no
 *  query in this codebase reuses a placeholder or relies on sqlite's `?N`
 *  numbered form) into Postgres's `$1, $2, ...`. */
export function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Runs `sql` against `runner` (pool or client) and returns every row. */
export async function all(runner, sql, params = []) {
  const result = await runner.query(toPgSql(sql), params);
  return result.rows;
}

/** Runs `sql` against `runner` and returns the first row, or null. */
export async function get(runner, sql, params = []) {
  const result = await runner.query(toPgSql(sql), params);
  return result.rows[0] || null;
}

/** Runs `sql` (INSERT/UPDATE/DELETE) against `runner`. Returns
 *  { changes, rows } -- `changes` mirrors node:sqlite's `.run().changes`
 *  (row count affected); `rows` is populated when the query has a
 *  `RETURNING` clause (used in place of `.lastInsertRowid`). */
export async function run(runner, sql, params = []) {
  const result = await runner.query(toPgSql(sql), params);
  return { changes: result.rowCount || 0, rows: result.rows };
}

let ready = false;
let readyPromise = null;

export async function ensureDb() {
  if (ready) return getPool();
  if (!readyPromise) {
    readyPromise = (async () => {
      const p = getPool();
      await applySchema(p);
      ready = true;
      return p;
    })();
  }
  return readyPromise;
}

export async function getDb() {
  return ensureDb();
}

/**
 * Checks out a dedicated client from the pool, runs `BEGIN`, calls
 * `fn(client)`, then `COMMIT`/`ROLLBACK`, and always releases the client
 * back to the pool. `fn` MUST run every query in the transaction against the
 * `client` it is given (never against `getDb()`/the pool) or those queries
 * will run on a different, non-transactional connection.
 */
export async function withTransaction(poolOrIgnored, fn) {
  // `poolOrIgnored` is accepted (and ignored) for call-site compatibility
  // with the previous `withTransaction(db, fn)` signature -- the pool is
  // always (re)resolved here since it must be ready before checkout anyway.
  await ensureDb();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors if no active transaction
    }
    throw error;
  } finally {
    client.release();
  }
}
