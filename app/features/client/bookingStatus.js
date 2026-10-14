import { resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import { scheduleBookingParts } from "../../shared/lib/bookingParts";
import { normalizeBookingTimeLabel, timeLabelToMinutes } from "../../shared/lib/time";

/** Plain-language status for a booking row (the stored values are internal: تازه / درخواست ...). */
export function bookingStatusLabel(status = "") {
  if (status === "تایید شده") return "تأیید شد";
  if (status === "لغو") return "لغو شد";
  if (status === "منقضی شده") return "منقضی شد";
  if (status === AWAITING_CLIENT) return "در انتظار تو";
  return "در انتظار تأیید";
}

export function bookingStatusTone(status = "") {
  if (status === "تایید شده") return "done";
  if (status === "لغو") return "bad";
  if (status === "منقضی شده") return "expired";
  return "pending";
}

/** Active = still waiting for the salon (or for the client's answer to a new time), or confirmed. */
export function isBookingActive(booking) {
  return ["تازه", "درخواست", "تایید شده", AWAITING_CLIENT].includes(booking?.status || "تازه");
}

export function isBookingInPast(booking) {
  const rawDate = booking?.booking_date || booking?.date || "";
  if (!rawDate) return false;
  return resolveRollingPersianDate(rawDate).getTime() < resolveRollingPersianDate("امروز").getTime();
}

/** The client can cancel their own booking while it is active and not already past. */
export function canClientCancel(booking) {
  return isBookingActive(booking) && !isBookingInPast(booking);
}

/** The soonest still-active booking that hasn't passed yet (date, then clock time). */
export function pickNextBooking(bookings = []) {
  const toKey = (booking) => {
    const raw = booking?.booking_date || booking?.date || "";
    const day = raw ? resolveRollingPersianDate(raw).getTime() : 0;
    const clock = String(booking?.time || "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\D/g, "").padStart(4, "0");
    return day * 10000 + Number(clock || 0);
  };
  return bookings
    .filter((booking) => isBookingActive(booking) && !isBookingInPast(booking))
    .sort((a, b) => toKey(a) - toKey(b))[0] || null;
}

/** When a booking ends ("21:15"), from its services or its length; "" when that isn't known. */
export function bookingEndLabel(booking) {
  const parts = scheduleBookingParts(booking?.time, booking?.parts);
  if (parts.length >= 2) return parts[parts.length - 1].endLabel;
  const minutes = Number(booking?.duration_minutes) || 0;
  if (!minutes || !booking?.time) return "";
  const end = timeLabelToMinutes(normalizeBookingTimeLabel(booking.time)) + minutes;
  return `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

/** One booking across both tables (ids are per table): source + id. */
export function clientBookingKey(booking) {
  return `${booking?.bookingSource === "artist" ? "artist" : "salon"}-${booking?.id}`;
}
