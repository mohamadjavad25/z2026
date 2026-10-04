import { resolveRollingPersianDate } from "../../shared/lib/persianCalendar";

/** Plain-language status for a booking row (the stored values are internal: تازه / درخواست ...). */
export function bookingStatusLabel(status = "") {
  if (status === "تایید شده") return "تأیید شد";
  if (status === "لغو") return "لغو شد";
  if (status === "منقضی شده") return "منقضی شد";
  return "در انتظار تأیید";
}

export function bookingStatusTone(status = "") {
  if (status === "تایید شده") return "done";
  if (status === "لغو") return "bad";
  if (status === "منقضی شده") return "expired";
  return "pending";
}

/** Active = still waiting for the salon, or confirmed. */
export function isBookingActive(booking) {
  return ["تازه", "درخواست", "تایید شده"].includes(booking?.status || "تازه");
}

function isBookingInPast(booking) {
  const rawDate = booking?.booking_date || booking?.date || "";
  if (!rawDate) return false;
  return resolveRollingPersianDate(rawDate).getTime() < resolveRollingPersianDate("امروز").getTime();
}

/** The client can cancel their own booking while it is active and not already past. */
export function canClientCancel(booking) {
  return isBookingActive(booking) && !isBookingInPast(booking);
}
