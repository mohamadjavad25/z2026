import { isSlotInPast } from "../shared/lib/slots.js";
import { BOOKING_REQUEST_LEAD_MINUTES, TOO_FAR_TEXT, isTooFarToRequest, isTooSoonToRequest } from "../shared/lib/bookingWindow.js";
import { findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "../shared/lib/salonAvailability.js";
import { PUBLIC_BOOKING_SLOT_STEP, buildDayBookingSlots, timeLabelToMinutes } from "../shared/lib/time.js";
import { toPersianDigits } from "../shared/lib/digits.js";

/**
 * Whether a visit of `durationMinutes` may start at `time` on `bookingDateKey` at all, before anyone's
 * calendar is looked at: not already started, not too soon for a client's request, the salon open that
 * day, and the whole visit inside its hours. One place for POST /api/salon-bookings and the preview, so
 * what the preview says is exactly what the booking will be told.
 * → null when the slot is fine, else { status, error, code? } to answer with.
 */
export function visitSlotProblem({ hours, bookingDateKey, time, durationMinutes, isClient, now = new Date() }) {
  if (isSlotInPast(bookingDateKey, time, now)) {
    return { status: 409, error: "این ساعت گذشته؛ یه ساعت دیگه بزن.", code: "SLOT_PAST" };
  }
  // A client's request needs an answer from the salon first, so it can't start in the next few
  // minutes (the salon would have no time to see it). The salon's own entries are exempt.
  if (isClient && isTooSoonToRequest(bookingDateKey, time, now)) {
    return {
      status: 409,
      error: `این ساعت خیلی نزدیکه؛ سالن باید دست‌کم ${toPersianDigits(BOOKING_REQUEST_LEAD_MINUTES)} دقیقه وقت داشته باشه جواب بده. یه ساعت دیرتر بزن.`,
      code: "TOO_SOON"
    };
  }
  if (isClient && isTooFarToRequest(bookingDateKey, now)) return { status: 409, error: TOO_FAR_TEXT, code: "TOO_FAR" };
  const hour = findSalonHourForDateKey(hours, bookingDateKey);
  if (!isSalonHourOpen(hour)) {
    return { status: 409, error: "سالن این روز تعطیله.", code: "SALON_CLOSED" };
  }
  const window = salonDayWindow(hour);
  const requestedMinutes = timeLabelToMinutes(time);
  if (!buildDayBookingSlots(window.open, window.close, durationMinutes).some((slot) => timeLabelToMinutes(slot) === requestedMinutes)) {
    return { status: 409, error: "سالن این ساعت باز نیست؛ یه ساعت دیگه بزن.", code: "OUTSIDE_HOURS" };
  }
  return null;
}

export const ARTIST_OFF_HOURS_MESSAGE = "آرتیست این ساعت کار نمی‌کنه.";
export const ARTIST_OFF_GRID_MESSAGE = "یکی از ساعت‌های فهرست رو بزن.";

/**
 * The independent artist's side of visitSlotProblem: the day must be one the artist works, the whole visit inside
 * that day's hours, and the start on the 30-minute step counted from opening time (the times the booking page offers).
 * → null when fine, else { status: 409, error, code }.
 */
export function artistSlotProblem({ hours, bookingDateKey, time, durationMinutes }) {
  const hour = findSalonHourForDateKey(hours, bookingDateKey);
  if (!isSalonHourOpen(hour)) return { status: 409, error: ARTIST_OFF_HOURS_MESSAGE, code: "OUTSIDE_HOURS" };
  const window = salonDayWindow(hour);
  const open = timeLabelToMinutes(window.open);
  const close = timeLabelToMinutes(window.close);
  const start = timeLabelToMinutes(time);
  const length = Math.max(15, Number(durationMinutes) || 60);
  if (!(close > open) || start < open || start + length > close) {
    return { status: 409, error: ARTIST_OFF_HOURS_MESSAGE, code: "OUTSIDE_HOURS" };
  }
  if ((start - open) % PUBLIC_BOOKING_SLOT_STEP !== 0) {
    return { status: 409, error: ARTIST_OFF_GRID_MESSAGE, code: "OFF_GRID" };
  }
  return null;
}
