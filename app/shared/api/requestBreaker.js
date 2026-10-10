/**
 * Client-side circuit breaker for GET requests.
 *
 * A browser tab can stay open for days. If something in it ever starts re-requesting the same endpoint in a tight loop
 * (a bug, an expired session answering 401, a server that is down), every such tab multiplies into load on the API and,
 * through it, on the database. This puts a hard ceiling on that: when one path keeps failing quickly, further requests
 * to it are refused locally for a cooldown instead of reaching the server.
 *
 * Normal use never trips it: pollers run every 8-45 s and a healthy endpoint resets its counter on the first success.
 */
const FAILURE_STATUSES = new Set([401, 429]);

export function createRequestBreaker({ limit = 8, windowMs = 10_000, cooldownMs = 30_000, now = Date.now } = {}) {
  const paths = new Map();

  const isFailure = (status) => FAILURE_STATUSES.has(status) || status >= 500 || status === 0;

  return {
    /** True while `path` is cooling down and the request should not be sent. */
    isBlocked(path) {
      const entry = paths.get(path);
      if (!entry?.blockedUntil) return false;
      if (now() >= entry.blockedUntil) {
        paths.delete(path);
        return false;
      }
      return true;
    },
    /** Record the HTTP status of a finished request (0 = the request itself failed). */
    record(path, status) {
      if (!isFailure(status)) {
        paths.delete(path);
        return;
      }
      const time = now();
      const entry = paths.get(path);
      if (!entry || time - entry.firstAt > windowMs) {
        paths.set(path, { count: 1, firstAt: time, blockedUntil: 0 });
        return;
      }
      entry.count += 1;
      if (entry.count >= limit) entry.blockedUntil = time + cooldownMs;
    }
  };
}
