// A few seconds of memory for work many visitors repeat at once (a public salon page opened by a whole campaign).
// One computation is shared by everyone who asks while it runs and for `ttlMs` after; a failed one is never kept.
// In this server process only: nothing is written to disk, and another process simply computes its own copy.
export function createShortCache({ ttlMs = 5000, max = 500 } = {}) {
  const entries = new Map(); // key -> { at, promise }
  return {
    get(key, compute) {
      const now = Date.now();
      const hit = entries.get(key);
      if (hit && now - hit.at < ttlMs) return hit.promise;
      if (entries.size >= max) entries.clear();
      const promise = Promise.resolve().then(compute);
      const entry = { at: now, promise };
      entries.set(key, entry);
      promise.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
      return promise;
    },
    drop(key) { entries.delete(key); },
    clear() { entries.clear(); }
  };
}
