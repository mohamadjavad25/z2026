import { isSlotInPast } from "../shared/lib/slots.js";
import { BOOKING_REQUEST_LEAD_MINUTES, isTooSoonToRequest } from "../shared/lib/bookingWindow.js";
import { findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "../shared/lib/salonAvailability.js";
import { buildDayBookingSlots, timeLabelToMinutes } from "../shared/lib/time.js";
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
    return { status: 409, error: "این ساعت گذشته است. ساعت دیگری انتخاب کن.", code: "SLOT_PAST" };
  }
  // A client's request needs an answer from the salon first, so it can't start in the next few
  // minutes (the salon would have no time to see it). The salon's own entries are exempt.
  if (isClient && isTooSoonToRequest(bookingDateKey, time, now)) {
    return {
      status: 409,
      error: `برای رزرو باید حداقل ${toPersianDigits(BOOKING_REQUEST_LEAD_MINUTES)} دقیقه تا شروع نوبت مانده باشد تا سالن فرصت پاسخ داشته باشد. ساعت دیگری انتخاب کن.`,
      code: "TOO_SOON"
    };
  }
  const hour = findSalonHourForDateKey(hours, bookingDateKey);
  if (!isSalonHourOpen(hour)) {
    return { status: 409, error: "سالن در این روز تعطیل است.", code: "SALON_CLOSED" };
  }
  const window = salonDayWindow(hour);
  const requestedMinutes = timeLabelToMinutes(time);
  if (!buildDayBookingSlots(window.open, window.close, durationMinutes).some((slot) => timeLabelToMinutes(slot) === requestedMinutes)) {
    return { status: 409, error: "این ساعت خارج از زمان کاری سالن است.", code: "OUTSIDE_HOURS" };
  }
  return null;
}
