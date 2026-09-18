/**
 * In-process presence registry: userId -> number of currently-open SSE
 * connections (see app/api/messages/stream/route.js). "Online" here means
 * exactly one thing, honestly — this user has at least one live SSE
 * connection to this Node process right now. It is NOT a "seen in the last
 * N minutes" approximation.
 *
 * Like app/lib/chatEvents.js, this only works because the app is explicitly
 * single-process/single-server today (documented there too). A user can have
 * several tabs/devices open at once, so we track a count, not a boolean —
 * they only flip to "offline" once every one of their connections has
 * closed. If this app is ever split across multiple server instances, this
 * registry (and the presence broadcast built on it) must move to a shared
 * store (e.g. Redis) or it will silently show wrong/flapping presence for
 * users whose connections land on different instances.
 *
 * Stored on globalThis for the same reason as chatEvents.js: Next.js
 * dev-mode module reloads (Turbopack HMR) must reuse the same registry
 * instead of resetting everyone to "offline" on every hot reload.
 */
const registry = globalThis.__zibabanPresenceRegistry || new Map();
globalThis.__zibabanPresenceRegistry = registry;

/**
 * Registers one new open connection for userId.
 * Returns true iff this is their first connection (they just went online).
 */
export function connectPresence(userId) {
  const current = registry.get(userId) || 0;
  registry.set(userId, current + 1);
  return current === 0;
}

/**
 * Unregisters one closed connection for userId.
 * Returns true iff this was their last remaining connection (they just went offline).
 */
export function disconnectPresence(userId) {
  const current = registry.get(userId) || 0;
  const next = Math.max(0, current - 1);
  if (next === 0) registry.delete(userId);
  else registry.set(userId, next);
  return current > 0 && next === 0;
}

export function isOnline(userId) {
  return (registry.get(userId) || 0) > 0;
}

/** Returns the subset of `ids` that are currently online, as a Set for O(1) lookups. */
export function onlineUserIdSet(ids) {
  const set = new Set();
  for (const id of ids || []) {
    if (isOnline(id)) set.add(id);
  }
  return set;
}
