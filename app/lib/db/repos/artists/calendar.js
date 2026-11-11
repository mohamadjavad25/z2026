/**
 * What already holds an artist's day (bookings, break, leave), as the one answer to "is this artist free then". The
 * artist's own bookings and every salon booking that needs this artist ask here.
 */
import { getDb, all } from "../../connection.js";
import { artistRequestLapsedSql } from "../openRequests.js";
import { leaveRangesOn } from "../leaves.js";
import { formatPersianDateKey, persianDateKeyToDate, resolveRollingPersianDateKey } from "../../../../shared/lib/persianCalendar.js";
import { parseServiceDurationMinutes, rangesOverlap, timeLabelToMinutes } from "../../../../shared/lib/time.js";
import { breakRangesOn } from "../../../../shared/lib/artistBreak.js";
import { getArtistBreak } from "./breaks.js";
import { listArtistServices } from "./services.js";

export async function listArtistBookedSlots(artistUserId, { excludeBookingId = null, excludeBookingIds = [], onlyDateKey = null } = {}, runner = null) {
  const db = runner || (await getDb());
  const services = await listArtistServices(artistUserId, db);
  const serviceDurationMap = Object.fromEntries(
    services.map((service) => [service.name, parseServiceDurationMinutes(service.duration)])
  );
  const excluded = new Set([excludeBookingId, ...excludeBookingIds].filter((id) => id != null).map(Number));
  const rows = await all(db, `
    SELECT id, booking_date, time, status, service, duration_minutes
    FROM artist_bookings a
    WHERE artist_user_id = $1
      AND status NOT IN ('لغو', 'لغو شده', 'cancelled', 'منقضی شده')
      AND NOT ${artistRequestLapsedSql("a")}
      AND ($2::text IS NULL OR booking_date = $2 OR booking_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    ORDER BY id ASC
  `, [artistUserId, onlyDateKey || null]);
  return rows.filter((row) => !excluded.has(Number(row.id))).map((row) => ({
    id: row.id,
    booking_date: row.booking_date,
    time: row.time,
    status: row.status,
    service: row.service,
    duration_minutes: Number(row.duration_minutes)
      || serviceDurationMap[row.service]
      || 60
  }));
}

/**
 * What already holds an artist's day: their break and every active booking on that date, as
 * minute ranges. Loaded once and checked many times when testing several start times.
 */
export async function listArtistBusyRanges(artistUserId, bookingDate, { excludeBookingId = null, excludeBookingIds = [] } = {}, runner = null) {
  if (!artistUserId || !bookingDate) return [];
  const db = runner || (await getDb());
  const bookingDateKey = resolveRollingPersianDateKey(bookingDate);
  const ranges = [];
  // The daily window on the weekdays it is on, and today's «now» break (shared/lib/artistBreak.js).
  ranges.push(...breakRangesOn(await getArtistBreak(artistUserId, db), bookingDateKey));
  ranges.push(...await leaveRangesOn(artistUserId, bookingDateKey, db));
  const bookedSlots = await listArtistBookedSlots(artistUserId, { excludeBookingId, excludeBookingIds, onlyDateKey: bookingDateKey }, db);
  for (const item of bookedSlots) {
    if (resolveRollingPersianDateKey(item.booking_date) !== bookingDateKey) continue;
    const bookedStart = timeLabelToMinutes(item.time);
    ranges.push({ start: bookedStart, end: bookedStart + Math.max(15, Number(item.duration_minutes) || 60) });
  }
  // A visit that runs past midnight also holds the early hours of the next day (23:00 for 3 h holds until 02:00), and
  // a visit asked for late in the evening must not run into tomorrow's first booking: the neighbouring days' bookings
  // are shifted onto this day's clock (yesterday's by -24 h, tomorrow's by +24 h) and only the part that reaches in counts.
  for (const [offsetDays, shift] of [[-1, -1440], [1, 1440]]) {
    const neighbourKey = shiftedDateKey(bookingDateKey, offsetDays);
    if (!neighbourKey) continue;
    const neighbours = await listArtistBookedSlots(artistUserId, { excludeBookingId, excludeBookingIds, onlyDateKey: neighbourKey }, db);
    for (const item of neighbours) {
      if (resolveRollingPersianDateKey(item.booking_date) !== neighbourKey) continue;
      const start = timeLabelToMinutes(item.time) + shift;
      const end = start + Math.max(15, Number(item.duration_minutes) || 60);
      if (shift < 0 ? end > 0 : start < 1440 + 720) ranges.push({ start, end });
    }
  }
  return ranges;
}

/** The date key `days` before/after `dateKey`, or "" when the key is not a real day near today. */
function shiftedDateKey(dateKey, days) {
  const date = persianDateKeyToDate(dateKey);
  if (!date) return "";
  const moved = new Date(date);
  moved.setHours(12, 0, 0, 0);
  moved.setDate(moved.getDate() + days);
  return formatPersianDateKey(moved);
}

export async function isArtistSlotBlocked(artistUserId, bookingDate, time, durationMinutes = 60, excludeBookingId = null, runner = null) {
  if (!artistUserId || !bookingDate || !time) return false;
  const start = timeLabelToMinutes(time);
  const end = start + Math.max(15, Number(durationMinutes) || 60);
  const ranges = await listArtistBusyRanges(artistUserId, bookingDate, { excludeBookingId }, runner);
  return ranges.some((range) => rangesOverlap(start, end, range.start, range.end));
}
