/** The other direction: a team artist answering their calendar copy moves the salon's own booking with it. */
import { getDb, all, get, run } from "../../../connection.js";
import { resolveRollingPersianDateKey } from "../../../../../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel, timeLabelToMinutes } from "../../../../../shared/lib/time.js";
import { isMultiPartBooking, scheduleBookingParts, serializeBookingParts } from "../../../../../shared/lib/bookingParts.js";
import { AWAITING_CLIENT } from "../../../../../shared/lib/bookingOffer.js";
import { recordCancellation } from "./cancellation.js";
import { invalidateUnavailable } from "./unavailable.js";

/**
 * A staff artist confirming / declining the calendar entry the salon booked for them
 * (an artist_bookings row with source_salon_user_id) must move the salon's own booking
 * with it -- otherwise the salon and the client keep seeing the old status while the
 * artist's side says "confirmed". Finds the salon_bookings row this mirror was created
 * from (same salon, client, phone, service, day and clock time) and sets its status.
 * Runs on the caller's transaction so both tables change together.
 */
export async function syncSalonBookingFromArtistMirror(artistBooking, status, runner = null) {
  const result = await syncSalonBookingFromArtistMirrorUncached(artistBooking, status, runner);
  invalidateUnavailable(artistBooking?.source_salon_user_id || artistBooking?.sourceSalonUserId);
  return result;
}

async function syncSalonBookingFromArtistMirrorUncached(artistBooking, status, runner = null) {
  const salonUserId = Number(artistBooking?.source_salon_user_id || artistBooking?.sourceSalonUserId || 0);
  if (!salonUserId || !["تایید شده", "لغو"].includes(status)) return null;
  const db = runner || (await getDb());
  if (artistBooking.salon_booking_id) {
    return syncMultiPartBookingFromArtist(db, artistBooking, status);
  }
  const day = resolveRollingPersianDateKey(artistBooking.booking_date || artistBooking.bookingDate || "");
  const time = normalizeBookingTimeLabel(artistBooking.time || "");
  const rows = await all(db, `
    SELECT * FROM salon_bookings
    WHERE salon_user_id = $1 AND client = $2 AND phone = $3 AND service = $4 AND booking_date = $5
      AND status NOT IN ('لغو', 'منقضی شده')
    ORDER BY id DESC
  `, [
    salonUserId,
    artistBooking.client_name ?? artistBooking.clientName ?? "",
    artistBooking.client_phone ?? artistBooking.clientPhone ?? "",
    artistBooking.service || "",
    day
  ]);
  // Only a booking that is this artist's: one with her name on it at this salon, else one with no name (the salon let
  // the system pick her). Without this, the same client's booking at the same time with ANOTHER artist (a mother and
  // her daughter under one name and number) was the one cancelled (review of 2026-11-11).
  const names = new Set((await all(db, `
    SELECT name FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2
  `, [salonUserId, Number(artistBooking.artist_user_id ?? artistBooking.artistUserId ?? 0)])).map((item) => String(item.name || "").trim()));
  const sameTime = rows.filter((row) => normalizeBookingTimeLabel(row.time || "") === time);
  const match = sameTime.find((row) => names.has(String(row.staff || "").trim()))
    || sameTime.find((row) => !String(row.staff || "").trim());
  if (!match) return null;
  // The visit waits on the client's answer to a new time; the artist agreeing does not settle it.
  if (match.status === AWAITING_CLIENT && status === "تایید شده") return null;
  await run(db, "UPDATE salon_bookings SET status = $1 WHERE id = $2", [status, match.id]);
  // The artist's own answer: the salon row was cancelled by a provider (no counter for the salon, the artist's is
  // counted by the artist's route), and a proposal waiting on it is over.
  if (status === "لغو") {
    await recordCancellation(db, "salon_bookings", match.id, match.status, { by: "provider" });
    await run(db, "UPDATE salon_bookings SET proposal_date = '', proposal_time = '', proposal_staff = '', proposal_from = '', proposal_at = NULL WHERE id = $1", [match.id]);
  }
  return get(db, "SELECT * FROM salon_bookings WHERE id = $1", [match.id]);
}

/**
 * An artist answering their share of a multi-service booking. Confirming it does not decide the
 * whole visit (the salon approves that); declining it takes that artist off their services, so
 * the salon sees them unassigned and can give them to someone else. The rest of the visit stays.
 */
async function syncMultiPartBookingFromArtist(db, artistBooking, status) {
  const row = await get(db, "SELECT * FROM salon_bookings WHERE id = $1", [Number(artistBooking.salon_booking_id)]);
  if (!row || !isMultiPartBooking(row) || status !== "لغو") return null;
  const names = new Set((await all(db, `
    SELECT name FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2
  `, [row.salon_user_id, Number(artistBooking.artist_user_id)])).map((item) => String(item.name || "").trim()));
  const start = timeLabelToMinutes(normalizeBookingTimeLabel(artistBooking.time || ""));
  const end = start + Math.max(15, Number(artistBooking.duration_minutes) || 60);
  const parts = scheduleBookingParts(row.time, row.parts).map((part) => ({
    service: part.service,
    minutes: part.minutes,
    staff: names.has(part.staff) && part.start >= start && part.end <= end ? "" : part.staff
  }));
  await run(db, "UPDATE salon_bookings SET parts = $1 WHERE id = $2", [serializeBookingParts(parts), row.id]);
  return get(db, "SELECT * FROM salon_bookings WHERE id = $1", [row.id]);
}
