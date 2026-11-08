/**
 * "Now" for anything about the calendar or the clock: which day is today, has a booking started,
 * how long is left. On the server it is the server's clock. In the app it is the phone's clock
 * corrected by what the server said the time was, so a phone whose date or time is set wrong
 * still shows the real days and hours (HEALTH debt 12, 2026-11-08).
 *
 * Plain Date.now() stays right for measuring how long something took (a timer, a debounce), where
 * only the difference between two readings matters.
 */

// Smaller differences are network delay and the one-second precision of the Date header, not a
// wrong clock; following them would make labels flicker between requests.
const IGNORE_BELOW_MS = 90 * 1000;

let offsetMs = 0;

/** Milliseconds since 1970, by the server's clock. */
export function nowMs() {
  return Date.now() + offsetMs;
}

/** A Date for "now", by the server's clock. */
export function nowDate() {
  return new Date(nowMs());
}

/** How far the phone's clock is from the server's, in ms (0 when close enough). */
export function clockOffsetMs() {
  return offsetMs;
}

/**
 * Learn the server's time from a response's `Date` header. `sentAt`/`receivedAt` are the phone's
 * Date.now() around the request; the server answered somewhere in between. Only fresh answers
 * count: a response the browser kept in its cache carries the old moment it was first sent.
 */
export function learnServerTime(dateHeader, sentAt, receivedAt) {
  const serverMs = Date.parse(String(dateHeader || ""));
  if (!Number.isFinite(serverMs) || !Number.isFinite(sentAt) || !Number.isFinite(receivedAt)) return;
  if (receivedAt < sentAt || receivedAt - sentAt > 30 * 1000) return; // too slow to say when it was answered
  // The header drops the milliseconds: the server's moment is anywhere in [serverMs, serverMs + 1s).
  const delta = serverMs + 500 - (sentAt + receivedAt) / 2;
  offsetMs = Math.abs(delta) < IGNORE_BELOW_MS ? 0 : Math.round(delta);
}

/** Tests only. */
export function resetClockForTests() {
  offsetMs = 0;
}
