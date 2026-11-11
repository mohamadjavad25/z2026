/**
 * What already holds a salon's day: its live bookings as time ranges per team member, and the one rule for when two
 * of them clash. Every check of "is this time free in the salon" goes through here.
 */
import { all } from "../../../connection.js";
import { salonRequestLapsedSql } from "../../openRequests.js";
import { rangesOverlap, timeLabelToMinutes } from "../../../../../shared/lib/time.js";
import { isMultiPartBooking, scheduleBookingParts } from "../../../../../shared/lib/bookingParts.js";

/**
 * The time ranges a booking occupies, each with the staff name it holds. A multi-service
 * booking holds one range per service (with that service's artist); any other booking holds
 * one range for its whole length.
 */
export function bookingSegments(row) {
  if (isMultiPartBooking(row)) {
    return scheduleBookingParts(row.time, row.parts).map((part) => ({ staff: part.staff, start: part.start, end: part.end }));
  }
  const start = timeLabelToMinutes(row.time);
  return [{ staff: String(row.staff || "").trim(), start, end: start + Math.max(15, Number(row.duration_minutes) || 60) }];
}

/**
 * Staff conflict policy (product decision):
 * - staff="" (unassigned): conflicts with ANY overlapping non-cancelled booking that day
 *   (same as legacy exact-time SQL when staff was empty).
 * - staff set: conflicts only with overlapping bookings for that same staff name.
 */
export function staffScopesConflict(newStaff, existingStaff) {
  const next = String(newStaff || "").trim();
  const prev = String(existingStaff || "").trim();
  if (!next) return true;
  return next === prev;
}

// 'منقضی شده' (auto-expired: salon never responded within the booking-request
// window — see app/lib/bookingExpirySweep.js) must be excluded here exactly
// like 'لغو': an expired request no longer holds its slot, same as an
// actively-cancelled one. It's kept as a DISTINCT status value from 'لغو'
// only so the client-facing UI can tell "salon said no" apart from "nobody
// answered in time" — it must never be treated as "still active" for
// conflict/availability purposes.
export async function listActiveDayBookings(db, salonUserId, bookingDate, excludeId = null) {
  // A request whose window ran out, and an offer nobody answered for 6 hours, no longer hold their slot even
  // before the sweep has marked them: "alive" is decided here, at the moment of asking.
  if (excludeId == null) {
    return all(db, `
      SELECT id, staff, time, duration_minutes, service, status, parts
      FROM salon_bookings b
      WHERE salon_user_id = $1 AND booking_date = $2 AND status NOT IN ('لغو', 'منقضی شده') AND NOT ${salonRequestLapsedSql("b")}
    `, [salonUserId, bookingDate]);
  }
  return all(db, `
    SELECT id, staff, time, duration_minutes, service, status, parts
    FROM salon_bookings b
    WHERE salon_user_id = $1 AND booking_date = $2 AND status NOT IN ('لغو', 'منقضی شده') AND id != $3 AND NOT ${salonRequestLapsedSql("b")}
  `, [salonUserId, bookingDate, excludeId]);
}

export async function findOverlapConflict(db, {
  salonUserId,
  bookingDate,
  time,
  durationMinutes,
  staff,
  parts = "",
  excludeId = null
}) {
  const wanted = bookingSegments({ time, duration_minutes: durationMinutes, staff, parts });
  const rows = await listActiveDayBookings(db, salonUserId, bookingDate, excludeId);
  for (const row of rows) {
    for (const held of bookingSegments(row)) {
      const hit = wanted.find((segment) => staffScopesConflict(segment.staff, held.staff)
        && rangesOverlap(segment.start, segment.end, held.start, held.end));
      if (hit) return { ...row, conflictStaff: hit.staff };
    }
  }
  return null;
}
