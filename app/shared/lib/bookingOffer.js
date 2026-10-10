import { normalizeBookingTimeLabel } from "./time";

// The salon moved a client's booking to another time: it waits in this status until the
// client accepts (→ تایید شده) or declines (→ لغو). The time it had before is kept in
// salon_bookings.previous_booking_date / previous_time so the client sees what changed.
export const AWAITING_CLIENT = "در انتظار مشتری";

/** { fromDate, fromTime, toDate, toTime } for a booking waiting on the client, else null. */
export function bookingTimeOffer(booking) {
  if (booking?.status !== AWAITING_CLIENT) return null;
  return {
    fromDate: booking.previous_booking_date || booking.booking_date || "",
    fromTime: normalizeBookingTimeLabel(booking.previous_time || booking.time || ""),
    toDate: booking.booking_date || "",
    toTime: normalizeBookingTimeLabel(booking.time || "")
  };
}
