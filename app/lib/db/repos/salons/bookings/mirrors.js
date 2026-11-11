/**
 * The artists' calendar copies of a salon booking (artist_bookings rows that point back at the salon): the status a
 * copy carries, the copies of a multi-service visit, and the error that rolls a booking back when an artist is taken.
 */
import { all } from "../../../connection.js";
import { addArtistBookingInTx } from "../../artists/bookings.js";
import { groupConsecutiveParts } from "../../../../../shared/lib/bookingParts.js";
import { AWAITING_CLIENT } from "../../../../../shared/lib/bookingOffer.js";

/**
 * The status an artist's calendar copy carries. While the client decides on a new time the
 * copy keeps the status it had (a new copy waits as a request); the client's answer then
 * reaches it like any approve or cancel.
 */
export function mirrorStatus(status, previous = "") {
  if (status === AWAITING_CLIENT) return previous || "درخواست";
  return status || "تازه";
}

/** Thrown inside a transaction to roll the whole booking back when an artist's calendar is taken. */
export function artistConflictError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  err.rollbackArtist = true;
  return err;
}

/**
 * Puts each artist's share of a multi-service booking in their own calendar: one artist_bookings
 * row per run of back-to-back services by the same artist, pointing at the salon booking.
 * Services with no artist, or a staff member with no artist account, get no row.
 */
export async function createPartMirrors(db, salonUserId, booking, staffList) {
  const linkedArtistIds = [];
  for (const group of groupConsecutiveParts(booking.time, booking.parts)) {
    const person = staffList.find((item) => String(item.name || "").trim() === group.staff);
    const artistId = Number(person?.artist_user_id || 0);
    if (!group.staff || !artistId) continue;
    const created = await addArtistBookingInTx(artistId, {
      clientUserId: booking.client_user_id || null,
      client: booking.client,
      phone: booking.phone,
      service: group.service,
      bookingDate: booking.booking_date,
      time: group.startLabel,
      durationMinutes: group.minutes,
      sourceSalonUserId: salonUserId,
      salonBookingId: booking.id,
      status: mirrorStatus(booking.status)
    }, db);
    if (!created.ok) {
      throw artistConflictError(
        created.code || "ARTIST_SLOT_TAKEN",
        `${group.staff} از ${group.startLabel} تا ${group.endLabel} یه نوبت دیگه داره.`
      );
    }
    linkedArtistIds.push(artistId);
  }
  return [...new Set(linkedArtistIds)];
}

export async function listPartMirrors(db, salonBookingId) {
  return all(db, `
    SELECT * FROM artist_bookings
    WHERE salon_booking_id = $1 AND status NOT IN ('لغو', 'لغو شده', 'cancelled', 'منقضی شده')
    ORDER BY id
  `, [salonBookingId]);
}
