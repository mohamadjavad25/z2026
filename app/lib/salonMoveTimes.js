import * as salons from "./db/repos/salons.js";
import { isSlotInPast } from "../shared/lib/slots.js";
import { findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "../shared/lib/salonAvailability.js";
import { PUBLIC_BOOKING_SLOT_STEP, normalizeBookingTimeLabel, timeLabelToMinutes } from "../shared/lib/time.js";

// How far past closing a moved booking may run; only offered as "stay longer", never silently.
export const MOVE_OVERTIME_LIMIT_MINUTES = 120;

function minutesToLabel(total) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The times a salon can move one of its bookings to on `bookingDateKey`: every start from opening
 * at which all its services fit with the artists they have (listBookingMoveTimes), not in the
 * past, ending by closing time or -- marked with `overtimeMinutes` -- at most
 * MOVE_OVERTIME_LIMIT_MINUTES after it. The same list the picker shows and PATCH accepts.
 * → { ok, closed, close, times: [{ time, end, overtimeMinutes }] } or { ok: false } for another salon's booking.
 */
export async function bookingMoveOptions(salonUserId, bookingId, bookingDateKey) {
  const hour = findSalonHourForDateKey(await salons.listSalonHours(salonUserId), bookingDateKey);
  if (!isSalonHourOpen(hour)) return { ok: true, closed: true, close: "", times: [] };
  const window = salonDayWindow(hour);
  const open = timeLabelToMinutes(normalizeBookingTimeLabel(window.open));
  const close = timeLabelToMinutes(normalizeBookingTimeLabel(window.close));
  const candidates = [];
  for (let cursor = open; cursor < close; cursor += PUBLIC_BOOKING_SLOT_STEP) {
    const label = minutesToLabel(cursor);
    if (!isSlotInPast(bookingDateKey, label)) candidates.push(label);
  }
  const options = await salons.listBookingMoveTimes(bookingId, salonUserId, bookingDateKey, candidates, close);
  if (!options) return { ok: false };
  return {
    ok: true,
    closed: false,
    close: minutesToLabel(close),
    times: options.filter((option) => option.overtimeMinutes <= MOVE_OVERTIME_LIMIT_MINUTES)
  };
}
