import { normalizePhone } from "./repos/salons/common.js";

/**
 * Which booking rows belong to a client. ONE rule, used both to list a client's bookings and to
 * let them act on one (cancel, answer a new time) -- the two used to differ: the list also showed
 * the rows a salon or artist typed in for them (no account id, matched by phone), but cancelling
 * only found rows tied to their account, so a booking they could see answered "رزرو یافت نشد".
 *
 * - tied to their account (client_user_id);
 * - entered by the salon/artist for a walk-in: no account id, and the same phone;
 * - same, with no phone at all: the same name. A bare name is never matched against rows that
 *   have a phone, or the client would see other people's bookings that merely share their name.
 *
 * `cols` names the table's phone / name columns (salon_bookings and artist_bookings differ).
 * Returns `{ sql, params }`: `sql` is "(...)" for a WHERE clause, `params` its values, numbered
 * from `startAt`. `sql` is "" when the user has nothing to match on.
 */
export function clientBookingMatch(user, { alias = "b", phoneCol, nameCol, startAt = 1 } = {}) {
  const userId = Number(user?.id || 0);
  const phone = normalizePhone(user?.phone || "");
  const name = String(user?.name || "").trim();
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
  if (name) {
    conditions.push(`(${alias}.client_user_id IS NULL AND COALESCE(${alias}.${phoneCol}, '') = '' AND ${alias}.${nameCol} = ${next(name)})`);
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
