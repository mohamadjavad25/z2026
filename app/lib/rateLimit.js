/**
 * Minimal in-memory sliding-window rate limiter. Good enough for a single
 * Node process (this app has no multi-instance/serverless deployment) —
 * resets on restart, which is fine for abuse throttling rather than a hard
 * quota. Keyed by caller-supplied string (usually `${scope}:${userId}`).
 */
const buckets = new Map();

/**
 * @param {string} key - unique per (scope, actor) e.g. "message-send:42"
 * @param {number} limit - max hits allowed inside the window
 * @param {number} windowMs - window size in ms
 * @returns {{ ok: true } | { ok: false, retryAfterMs: number }}
 */
export function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (hits.length >= limit) {
    const retryAfterMs = windowMs - (now - hits[0]);
    return { ok: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true };
}

// Periodic sweep so the map doesn't grow unbounded with stale keys from
// users who sent a burst once and never came back.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_KEY_AGE_MS = 30 * 60 * 1000;
if (typeof setInterval === "function" && !globalThis.__zibabanRateLimitSweepStarted) {
  globalThis.__zibabanRateLimitSweepStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, hits] of buckets) {
      const freshHits = hits.filter((ts) => now - ts < MAX_KEY_AGE_MS);
      if (freshHits.length === 0) buckets.delete(key);
      else buckets.set(key, freshHits);
    }
  }, SWEEP_INTERVAL_MS).unref?.();
}
