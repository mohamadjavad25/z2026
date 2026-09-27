import { Pool } from "pg";
import { applySchema } from "./schema.js";

/**
 * Vercel's Supabase integration sets POSTGRES_URL (pooled, via Supavisor in
 * transaction mode -- fine for a serverless function's short connection
 * lifetime and avoids exhausting Supabase's direct-connection limit) and
 * POSTGRES_URL_NON_POOLING (direct). DATABASE_URL is accepted as a common
 * fallback name so this also works against a plain self-hosted Postgres.
 */
const rawConnectionString =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  "";

/**
 * Supabase's connection strings include `?sslmode=require` (sometimes with
 * other query params). `pg` parses that itself and, on some versions,
 * derives its own default-strict TLS options from it that can win out
 * over -- or fight with -- an explicit `ssl` config object, producing
 * `SELF_SIGNED_CERT_IN_CHAIN` even though we pass rejectUnauthorized:false
 * (Supabase's Postgres presents a cert chain that isn't in Node's default
 * trust store). Stripping sslmode from the string removes that ambiguity;
 * our own `ssl` option below is then the only source of truth.
 */
function stripSslMode(connString) {
  if (!connString) return connString;
  try {
    const url = new URL(connString);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return connString;
  }
}

const connectionString = stripSslMode(rawConnectionString);
const sslDisabled = rawConnectionString.includes("sslmode=disable");

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
    // Supabase (and most managed Postgres) requires TLS and presents a
    // certificate chain that isn't in Node's default trust store;
    // rejectUnauthorized:false matches what Supabase's/Vercel's own
    // Postgres quickstart snippets use. This can be tightened with a real
    // CA bundle later if desired.
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    // POSTGRES_URL is Supabase's Supavisor pooler in transaction mode --
    // it already multiplexes many app-side "connections" onto a small set
    // of real Postgres backends, so a generous per-instance pool here just
    // multiplies against Supavisor's own connection cap (many concurrent
    // Vercel function instances each keeping up the `pg` default of 10).
    // Keeping this small leaves Supavisor's pool as the actual bottleneck
    // instead of exhausting it. connectionTimeoutMillis turns "no
    // connection available" into a fast, clear error instead of the
    // default (wait forever) -- previously a saturated pooler meant the
    // request just hung until Postgres's own statement_timeout or
    // Vercel's function timeout killed it.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000
  });
  // pg's own docs: a pooled client sitting idle can still be dropped by the
  // network/remote side (exactly what Supavisor's own idle/connection
  // limits do) -- when that happens the Pool emits 'error' on an idle
  // client with no query attached to catch it, and Node treats an
  // unhandled 'error' event as fatal (crashes the process). Without this
  // listener, one dropped idle connection could take down the whole warm
  // serverless instance -- every request already in flight on it fails,
  // and Vercel has to cold-start a replacement -- which reads externally
  // as exactly the kind of sudden multi-minute burst of unrelated
  // timeouts/"Connection terminated unexpectedly" errors seen here. This
  // just logs it and lets the pool quietly open a fresh connection on the
  // next checkout instead.
  pool.on("error", (error) => {
    console.error("Idle Postgres client error (pool recovers automatically):", error.message);
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

// Arbitrary fixed key for the schema-setup advisory lock (any bigint works;
// just needs to be the same constant everywhere this runs).
const SCHEMA_LOCK_KEY = 727310;

let ready = false;
let readyPromise = null;

/**
 * `CREATE TABLE IF NOT EXISTS` is not safe under concurrent execution --
 * two connections can both see "doesn't exist yet" and race to create it,
 * and one loses with a duplicate-key error against Postgres's own system
 * catalog (pg_type), not a real app table. On Vercel this is common:
 * several serverless instances can cold-start around the same moment,
 * each running ensureDb() for the first time in its own process memory
 * (the `ready` flag above only dedupes within a single instance).
 *
 * This used to serialize applySchema() with a *session*-level
 * pg_advisory_lock/unlock pair. POSTGRES_URL is Supabase's pooled
 * Supavisor connection in transaction mode, which is free to swap the
 * physical backend behind a client's socket between statements (only a
 * single in-flight transaction is pinned to one backend). A session lock
 * taken on one statement could end up "held" by a backend that a later
 * unlock statement never reaches, orphaning it forever -- every future
 * cold start then blocks inside pg_advisory_lock waiting on a lock nobody
 * can ever release, until Postgres's statement_timeout kills the wait and
 * the request 500s. That's exactly what took every DB-backed route down
 * (see incident: every route calling ensureDb() started failing with
 * "canceling statement due to statement timeout").
 *
 * pg_try_advisory_xact_lock is transaction-scoped: it's released
 * automatically at COMMIT/ROLLBACK, which lines up with the one backend
 * Supavisor pins for that single transaction, so it can never leak across
 * a pooled connection swap. It's also non-blocking, so a genuinely stuck
 * lock (e.g. left over from the old code, on a backend Supabase hasn't
 * recycled yet) can never wedge every future request again -- we just
 * retry briefly, then proceed assuming the schema (already long
 * established in production) is there.
 */
async function tryAcquireSchemaLock(client) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { rows } = await client.query("SELECT pg_try_advisory_xact_lock($1) AS locked", [SCHEMA_LOCK_KEY]);
    if (rows[0]?.locked) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

export async function ensureDb() {
  if (ready) return getPool();
  if (!readyPromise) {
    readyPromise = (async () => {
      const p = getPool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        try {
          if (await tryAcquireSchemaLock(client)) {
            await applySchema(client);
          }
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        }
      } finally {
        client.release();
      }
      ready = true;
      return p;
    })().catch((error) => {
      // Don't let one failed attempt permanently poison this warm
      // instance -- without this, every request landing on it would keep
      // replaying the same cached rejection until the instance recycles.
      readyPromise = null;
      throw error;
    });
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
