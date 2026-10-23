import { run } from "./connection.js";

/**
 * Booking days are booked one at a time. Two requests for the same salon day (or the same artist's
 * day) used to both read "free", both insert, and the day ended up double-booked, because a plain
 * check-then-insert is not atomic under READ COMMITTED. These take Postgres advisory locks that live
 * until the surrounding transaction ends, so the second request waits, then sees the first one.
 *
 * Order matters (a deadlock otherwise): always the salon's day first, then artists' days in
 * ascending id. Every caller below follows it; take the whole set in one call where you can.
 * Lock only from inside a transaction -- outside one the lock is gone as soon as the statement ends.
 */
const advisory = (db, key) => run(db, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);

/**
 * One client's open requests are counted and added one at a time (the cap of 3 per provider / 5 in total, and the
 * merge of an identical double-submit), so a burst of parallel requests can't slip past either. Taken FIRST, before
 * any salon or artist day: client, then salon's day, then artists' days.
 */
export function lockClientRequests(db, clientUserId) {
  return advisory(db, `client-requests:${Number(clientUserId)}`);
}

export function lockSalonDay(db, salonUserId, bookingDate) {
  return advisory(db, `salon-day:${Number(salonUserId)}:${bookingDate}`);
}

export async function lockArtistDays(db, artistUserIds, bookingDate) {
  const ids = [...new Set((artistUserIds || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].sort((a, b) => a - b);
  for (const id of ids) await advisory(db, `artist-day:${id}:${bookingDate}`);
}

/** A salon's day and the days of the artists who might take part, in the one safe order. */
export async function lockVisitDay(db, salonUserId, bookingDate, artistUserIds = []) {
  await lockSalonDay(db, salonUserId, bookingDate);
  await lockArtistDays(db, artistUserIds, bookingDate);
}
