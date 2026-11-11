import { getDb, all } from "../../../connection.js";
import { salonRequestLapsedSql } from "../../openRequests.js";
import { formatPersianDateKey } from "../../../../../shared/lib/persianCalendar.js";
import { bumpSalonAvailability } from "../../../../availabilityCache.js";
import { ensureBookingPartsColumns } from "./columns.js";

// What a client's booking screen needs to grey out: the live bookings of the next weeks, not the salon's whole
// history. Asked for by every client who opens the salon, so it is read narrowly and kept for a few seconds
// (dropped at once when a booking in this process changes it; a stale slot is still refused by the booking itself).
const UNAVAILABLE_WINDOW_DAYS = 60;
const UNAVAILABLE_TTL_MS = 5000;
const unavailableCache = new Map();

export async function listUnavailableSlots(salonUserId) {
  const id = Number(salonUserId);
  const hit = unavailableCache.get(id);
  if (hit && Date.now() - hit.at < UNAVAILABLE_TTL_MS) return hit.rows;
  await ensureBookingPartsColumns();
  const db = await getDb();
  const from = formatPersianDateKey(new Date());
  const to = formatPersianDateKey(new Date(Date.now() + UNAVAILABLE_WINDOW_DAYS * 86400000));
  const rows = await all(db, `
    SELECT booking_date, time, duration_minutes, service, staff, status
    FROM salon_bookings b
    WHERE salon_user_id = $1 AND booking_date >= $2 AND booking_date <= $3
      AND status NOT IN ('لغو', 'منقضی شده') AND NOT ${salonRequestLapsedSql("b")}
    ORDER BY id
  `, [id, from, to]);
  if (unavailableCache.size > 500) unavailableCache.clear();
  unavailableCache.set(id, { at: Date.now(), rows });
  return rows;
}

/** Drops the short-lived list of a salon's taken slots (after bookings of it were changed outside this module's own paths). */
export function invalidateUnavailable(salonUserId) {
  unavailableCache.delete(Number(salonUserId));
  bumpSalonAvailability(salonUserId);
}
