import { getDb, get, run } from "./db/connection.js";

/**
 * DB-backed sliding-window rate limiter (rate_limit_hits table, migration
 * 007). Replaces a previous in-memory Map implementation whose own comment
 * claimed "this app has no multi-instance/serverless deployment" -- false
 * for the app's actual Vercel serverless target: each serverless instance
 * has its own independent process memory, so an in-memory bucket resets on
 * every cold start and is trivially bypassed by a caller whose requests
 * happen to land on different instances (or just bad luck with cold
 * starts). A shared Postgres table is the one thing every instance
 * actually has in common.
 *
 * Not perfectly atomic under heavy concurrency (two simultaneous calls for
 * the same key can both read a count under the limit and both insert,
 * overshooting it by a small margin) -- acceptable for abuse throttling
 * the same way the old in-memory version was also only approximate, and
 * not worth a transaction/advisory-lock for this use case.
 *
 * @param {string} key - unique per (scope, actor) e.g. "login:09121234567"
 * @param {number} limit - max hits allowed inside the window
 * @param {number} windowMs - window size in ms
 * @returns {Promise<{ ok: true } | { ok: false, retryAfterMs: number }>}
 */
export async function checkRateLimit(key, limit, windowMs) {
  const db = await getDb();
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const row = await get(db, `
    SELECT COUNT(*) AS c, MIN(hit_at) AS oldest
    FROM rate_limit_hits
    WHERE key = $1 AND hit_at > $2
  `, [key, windowStart]);
  const count = Number(row?.c || 0);
  if (count >= limit) {
    const oldestMs = row?.oldest ? new Date(row.oldest).getTime() : Date.now();
    const retryAfterMs = Math.max(windowMs - (Date.now() - oldestMs), 0);
    return { ok: false, retryAfterMs };
  }
  await run(db, "INSERT INTO rate_limit_hits (key, hit_at) VALUES ($1, NOW())", [key]);
  // Opportunistic cleanup instead of a scheduled sweep (a setInterval sweep
  // has the same serverless-instance problem this whole rewrite exists to
  // fix -- it might never run again after a cold start): a small random
  // chance on any check to prune hits old enough that no window this app
  // uses could still care about them. Best-effort -- a failed cleanup
  // never blocks the actual rate-limit decision above.
  if (Math.random() < 0.01) {
    run(db, "DELETE FROM rate_limit_hits WHERE hit_at < NOW() - INTERVAL '1 hour'").catch(() => {});
  }
  return { ok: true };
}
