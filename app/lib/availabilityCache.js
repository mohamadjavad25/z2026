// A few seconds of memory for "which start times are free" (GET /api/salon-bookings/availability).
// Many clients open the same salon and day at once (a campaign, a busy morning); the answer is the same
// for all of them, so one computation is shared (also by callers that arrive while it is still running).
//
// Safety rules:
//  - It only ever DISPLAYS times. Creating a booking never reads it: POST re-checks everything under
//    row locks (lockVisitDay), so a stale "free" time is refused with 409 and nothing is double-booked.
//  - Any change to a salon's bookings in this process drops that salon's entries at once (bumpSalonAvailability).
//    Changes made by another process, or to hours/services/team, show up when the entry expires (TTL).
const TTL_MS = 5000;
const MAX_ENTRIES = 2000;
const entries = new Map(); // key -> { at, promise }
const salonKeys = new Map(); // salonUserId -> Set of keys

export function availabilityKey(salonUserId, day, parts, viewerIsClient) {
  return `${Number(salonUserId)}|${day}|${viewerIsClient ? "c" : "o"}|${parts.map((p) => `${p.service}:${p.minutes}`).join(",")}`;
}

/** Returns the cached (or in-flight) result for `key`, else runs `compute` once and shares it. */
export function cachedAvailability(salonUserId, key, compute) {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.promise;
  if (entries.size >= MAX_ENTRIES) { entries.clear(); salonKeys.clear(); }
  const promise = Promise.resolve().then(compute);
  const entry = { at: now, promise };
  entries.set(key, entry);
  const id = Number(salonUserId);
  if (!salonKeys.has(id)) salonKeys.set(id, new Set());
  salonKeys.get(id).add(key);
  // A failed computation is never kept.
  promise.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
  return promise;
}

/** Drops every cached answer of one salon (call after any booking of it is created, answered, moved or cancelled). */
export function bumpSalonAvailability(salonUserId) {
  const id = Number(salonUserId);
  const keys = salonKeys.get(id);
  if (!keys) return;
  for (const key of keys) entries.delete(key);
  salonKeys.delete(id);
}

export function clearAvailabilityCache() {
  entries.clear();
  salonKeys.clear();
}
