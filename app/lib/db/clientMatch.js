import { normalizePhone } from "./repos/salons/common.js";

/**
 * Which booking rows belong to a client. ONE rule, used both to list a client's bookings and to
 * let them act on one (cancel, answer a new time) -- the two used to differ: the list also showed
 * the rows a salon or artist typed in for them (no account id, matched by phone), but cancelling
 * only found rows tied to their account, so a booking they could see answered "رزرو یافت نشد".
 *
 * - tied to their account (client_user_id);
 * - entered by the salon/artist for a walk-in: no account id, and the same phone -- only once the
 *   account proved it owns that number with an SMS code (users.phone_verified_at). Anyone can sign up
 *   with any number while the code is not required, and must not see or cancel that person's bookings.
 *
 * A name alone never matches: it is chosen by the user, so anyone could pick a common name and see
 * every phone-less walk-in booking under it.
 *
 * `cols` names the table's phone column (salon_bookings and artist_bookings differ).
 * Returns `{ sql, params }`: `sql` is "(...)" for a WHERE clause, `params` its values, numbered
 * from `startAt`. `sql` is "" when the user has nothing to match on.
 */
export function clientBookingMatch(user, { alias = "b", startAt = 1 } = {}) {
  const userId = Number(user?.id || 0);
  const phone = user?.phone_verified_at ? normalizePhone(user?.phone || "") : "";
  const conditions = [];
  const params = [];
  const next = (value) => {
    params.push(value);
    return `$${startAt + params.length - 1}`;
  };
  if (userId) conditions.push(`${alias}.client_user_id = ${next(userId)}`);
  if (phone) {
    // phone_normalized is a generated, indexed column (migrations/005_normalized_phone.sql).
    conditions.push(`(${alias}.client_user_id IS NULL AND ${alias}.phone_normalized = ${next(phone)})`);
  }
  return { sql: conditions.length ? `(${conditions.join(" OR ")})` : "", params };
}

/**
 * What a client is shown for a booking's state. Two stored values are "settled" ones that a
 * client's screens would otherwise read as «در انتظار تأیید», with a countdown to an automatic
 * cancellation that never comes (the expiry sweep only touches requests):
 *  - salon_bookings "تازه": the salon entered it itself, nobody has to answer it;
 *  - artist_bookings "تایید": the artist entered it in their own calendar.
 * (An artist_bookings "تازه" IS a client's request waiting for the artist, so it stays.)
 */
export function clientVisibleStatus(status, source) {
  if (source === "salon" && status === "تازه") return "تایید شده";
  if (source === "artist" && status === "تایید") return "تایید شده";
  return status;
}
