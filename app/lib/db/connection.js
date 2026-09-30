import { Pool } from "pg";
import { readFileSync } from "node:fs";

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

/**
 * TLS trust configuration. Three modes, in priority order:
 *
 * 1. `sslmode=disable` in the connection string -> no TLS at all (local
 *    Postgres with no TLS configured).
 * 2. `PGSSL_CA_PATH` set -> full certificate verification
 *    (`rejectUnauthorized: true`) against that CA bundle. This is the
 *    hardened path: get your provider's CA certificate (for Supabase:
 *    dashboard -> Project Settings -> Database -> SSL Configuration) and
 *    point PGSSL_CA_PATH at the downloaded file.
 * 3. Neither set (today's default) -> `rejectUnauthorized: false`. This
 *    accepts any certificate the server presents, which is vulnerable to a
 *    MITM able to intercept the connection -- kept as the default only
 *    because it matches Supabase's/Vercel's own Postgres quickstart
 *    snippets and this codebase has previously hit `SELF_SIGNED_CERT_IN_CHAIN`
 *    against Supabase's pooler without it (a real incident, not
 *    theoretical). Set PGSSL_CA_PATH once you've obtained and verified
 *    your provider's actual CA certificate to close this gap.
 */
function resolveSslConfig() {
  if (sslDisabled) return false;
  const caPath = process.env.PGSSL_CA_PATH;
  if (caPath) {
    return { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

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
    ssl: resolveSslConfig(),
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

/** Converts this codebase's chosen `?` positional-placeholder convention
 *  (each `?` consumes the next value in `params`, left to right -- verified:
 *  no query in this codebase reuses a placeholder or needs Postgres's `$N`
 *  numbered-reuse form) into Postgres's native `$1, $2, ...`. Kept as a
 *  small, isolated, unit-verifiable translation rather than rewriting the
 *  ~390 `?` placeholders across every repos/*.js query in place: `pg`
 *  requires `$N` syntax, but many of these queries build their SQL from
 *  interpolated fragments (see e.g. posts.js's `postSelect` reuse,
 *  salons/bookings.js's dynamic `conditions.join(" OR ")`), where a
 *  literal find-replace across 18 files risks silently miscounting a
 *  placeholder and binding a value to the wrong column -- a correctness
 *  risk with no behavioral upside, since this function already does the
 *  translation correctly and is one place to verify, not 18. */
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
 *  { rowCount, rows } -- `rowCount` is the number of rows affected; `rows`
 *  is populated when the query has a `RETURNING` clause. */
export async function run(runner, sql, params = []) {
  const result = await runner.query(toPgSql(sql), params);
  return { rowCount: result.rowCount || 0, rows: result.rows };
}

/**
 * Schema readiness used to be established per-request here (an
 * advisory-lock-guarded `CREATE TABLE IF NOT EXISTS` script re-run on every
 * cold start -- see git history for why that needed a
 * pg_try_advisory_xact_lock guard against Supavisor's transaction-mode
 * pooling). The schema is now versioned in migrations/ and applied once at
 * deploy time via `npm run migrate` (node-pg-migrate), not at request time,
 * so ensureDb()/getDb() just resolve the pool -- kept as async functions
 * (rather than a plain export of getPool()) so existing `await ensureDb()`
 * call sites throughout app/api and app/lib/db/repos don't all need to
 * change.
 */
export async function ensureDb() {
  return getPool();
}

export async function getDb() {
  return getPool();
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
