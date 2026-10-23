import { all } from "../connection.js";
import { isSlotInPast } from "../../../shared/lib/slots.js";
import { AWAITING_CLIENT } from "../../../shared/lib/bookingOffer.js";
import { normalizeBookingTimeLabel } from "../../../shared/lib/time.js";

/**
 * Rules for a client's booking REQUESTS that wait for a salon or artist (user's decisions 2026-10-21, "Package 1"):
 * - a request is "alive" only while its window has not run out and its appointment has not started, worked out at
 *   the moment of asking (not when the 5-minute sweep gets round to it);
 * - "any time" (wait_minutes NULL) waits until the appointment, but never longer than 24 hours;
 * - a new time the salon offered is held 6 hours;
 * - one client has at most 3 open requests with one salon/artist and 5 in total;
 * - the very same request sent twice (double tap, slow network) is one request.
 * The SQL fragments below are the one definition of "no longer alive" used by every query that lets a request hold a slot.
 */
export const MAX_OPEN_REQUESTS_PER_PROVIDER = 3;
export const MAX_OPEN_REQUESTS_TOTAL = 5;
export const OPEN_WAIT_MAX_MINUTES = 24 * 60;
export const OFFER_HOLD_HOURS = 6;
export const TOO_MANY_OPEN_MESSAGE = "چند تا درخواست منتظر جواب داری. صبر کن جواب یکی بیاد، یا یکی رو لغو کن.";
export const TOO_MANY_OPEN_CODE = "TOO_MANY_OPEN_REQUESTS";

const dot = (alias) => (alias ? `${alias}.` : "");

/** The response window ran out (a request with no window waits at most OPEN_WAIT_MAX_MINUTES), by the database's own clock. */
const windowLapsed = (alias) => `${dot(alias)}created_at <= (NOW() - (COALESCE(${dot(alias)}wait_minutes, ${OPEN_WAIT_MAX_MINUTES}) * INTERVAL '1 minute'))`;

/** A salon_bookings row that is a waiting request (or an unanswered offer) and has run out of time. */
export function salonRequestLapsedSql(alias = "") {
  const a = dot(alias);
  return `((${a}status = 'درخواست' AND ${windowLapsed(alias)})
    OR (${a}status = '${AWAITING_CLIENT}' AND COALESCE(${a}offer_at, ${a}created_at) <= (NOW() - INTERVAL '${OFFER_HOLD_HOURS} hours')))`;
}

/**
 * An artist_bookings row that is a waiting request and has run out of time: a direct request by its own window, or
 * the calendar copy of a salon request when the salon's request it was made from has (the copy ages with its
 * request, however it was made: found by its multi-service link or by the same client, service, day and time).
 */
export function artistRequestLapsedSql(alias = "") {
  const a = dot(alias);
  return `((${a}status = 'تازه' AND ${a}source_salon_user_id IS NULL AND ${windowLapsed(alias)})
    OR (${a}status = 'درخواست' AND ${a}source_salon_user_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM salon_bookings sb
      WHERE sb.salon_user_id = ${a}source_salon_user_id
        AND (sb.id = ${a}salon_booking_id OR (${a}salon_booking_id IS NULL AND sb.client = ${a}client_name AND sb.phone = ${a}client_phone
          AND sb.service = ${a}service AND sb.booking_date = ${a}booking_date AND sb.time = ${a}time))
        AND ${salonRequestLapsedSql("sb")}
    )))`;
}

/** Statuses of a request that still waits for an answer (before its time is checked). */
const WAITING = new Set(["درخواست", AWAITING_CLIENT]);

/** True when a booking row that waits for an answer has already started (it can no longer be answered). */
export function requestStarted(row) {
  return WAITING.has(row.status) && isSlotInPast(row.booking_date, row.time);
}

/**
 * How many requests of `clientUserId` are open right now: in total, and with this one provider
 * ({ kind: "salon" | "artist", id }). Runs inside the transaction that holds lockClientRequests.
 */
export async function countOpenRequests(db, clientUserId, provider) {
  const salonRows = await all(db, `
    SELECT salon_user_id AS provider_id, booking_date, time, status FROM salon_bookings b
    WHERE client_user_id = $1 AND status = 'درخواست' AND NOT ${salonRequestLapsedSql("b")}
  `, [clientUserId]);
  const artistRows = await all(db, `
    SELECT artist_user_id AS provider_id, booking_date, time, 'درخواست' AS status FROM artist_bookings a
    WHERE client_user_id = $1 AND status = 'تازه' AND source_salon_user_id IS NULL AND NOT ${artistRequestLapsedSql("a")}
  `, [clientUserId]);
  const live = (rows) => rows.filter((row) => !requestStarted(row));
  const salon = live(salonRows);
  const artist = live(artistRows);
  const same = provider.kind === "salon" ? salon : artist;
  return {
    total: salon.length + artist.length,
    withProvider: same.filter((row) => Number(row.provider_id) === Number(provider.id)).length
  };
}

/** True when this client may not send one more request to `provider` right now. */
export async function openRequestLimitReached(db, clientUserId, provider) {
  const open = await countOpenRequests(db, clientUserId, provider);
  return open.withProvider >= MAX_OPEN_REQUESTS_PER_PROVIDER || open.total >= MAX_OPEN_REQUESTS_TOTAL;
}

/** The live salon booking this client already sent for exactly this service, day and time (or null). */
export async function findIdenticalSalonRequest(db, { salonUserId, clientUserId, bookingDate, time, service }) {
  const rows = await all(db, `
    SELECT * FROM salon_bookings b
    WHERE salon_user_id = $1 AND client_user_id = $2 AND booking_date = $3 AND service = $4
      AND status NOT IN ('لغو', 'منقضی شده') AND NOT ${salonRequestLapsedSql("b")}
    ORDER BY id
  `, [salonUserId, clientUserId, bookingDate, service]);
  const wanted = normalizeBookingTimeLabel(time);
  return rows.find((row) => normalizeBookingTimeLabel(row.time || "") === wanted) || null;
}

/** The live direct artist booking this client already sent for exactly this service, day and time (or null). */
export async function findIdenticalArtistRequest(db, { artistUserId, clientUserId, bookingDate, time, service }) {
  const rows = await all(db, `
    SELECT * FROM artist_bookings a
    WHERE artist_user_id = $1 AND client_user_id = $2 AND source_salon_user_id IS NULL AND booking_date = $3 AND service = $4
      AND status NOT IN ('لغو', 'لغو شده', 'cancelled', 'منقضی شده') AND NOT ${artistRequestLapsedSql("a")}
    ORDER BY id
  `, [artistUserId, clientUserId, bookingDate, service]);
  const wanted = normalizeBookingTimeLabel(time);
  return rows.find((row) => normalizeBookingTimeLabel(row.time || "") === wanted) || null;
}
