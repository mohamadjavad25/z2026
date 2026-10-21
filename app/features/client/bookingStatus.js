import { resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import { bookingWaitMinutes, minutesUntilSlotStart, requestDeadlineLabel } from "../../shared/lib/bookingWindow";
import { scheduleBookingParts } from "../../shared/lib/bookingParts";
import { getTehranClockMinutes, normalizeBookingTimeLabel, timeLabelToMinutes } from "../../shared/lib/time";

/** Plain-language status for a booking row (the stored values are internal: تازه / درخواست ...). */
export function bookingStatusLabel(status = "") {
  if (status === "تایید شده" || status === "تایید") return "تأیید شد";
  if (status === "لغو") return "لغو شد";
  if (status === "منقضی شده") return "منقضی شد";
  if (status === AWAITING_CLIENT) return "در انتظار تو";
  return "در انتظار تأیید";
}

export function bookingStatusTone(status = "") {
  if (status === "تایید شده" || status === "تایید") return "done";
  if (status === "لغو") return "bad";
  if (status === "منقضی شده") return "expired";
  return "pending";
}

/** Active = still waiting for the salon (or for the client's answer to a new time), or confirmed. */
export function isBookingActive(booking) {
  return ["تازه", "درخواست", "تایید", "تایید شده", AWAITING_CLIENT].includes(booking?.status || "تازه");
}

export function isBookingInPast(booking) {
  const rawDate = booking?.booking_date || booking?.date || "";
  if (!rawDate) return false;
  return resolveRollingPersianDate(rawDate).getTime() < resolveRollingPersianDate("امروز").getTime();
}

/** The appointment's start time has passed (today's 10:00 booking at 14:29), not just its day. */
export function hasBookingStarted(booking, now = new Date()) {
  if (isBookingInPast(booking)) return true;
  const until = minutesUntilSlotStart(booking?.booking_date || booking?.date, booking?.time, now);
  return until !== null && until <= 0;
}

/** The appointment is over: its end time has passed (a booking in progress is not over). */
export function hasBookingEnded(booking, now = new Date()) {
  if (isBookingInPast(booking)) return true;
  const until = minutesUntilSlotStart(booking?.booking_date || booking?.date, booking?.time, now);
  if (until === null || until === Infinity) return false;
  const end = bookingEndLabel(booking);
  const start = timeLabelToMinutes(normalizeBookingTimeLabel(booking.time));
  const endMinutes = end ? timeLabelToMinutes(end) : start;
  return (endMinutes >= start ? endMinutes : start) <= getTehranClockMinutes(now);
}

/** Still to come or under way: active, and not over yet. These are the full cards; the rest are one-line notes. */
export function isBookingAhead(booking, now = new Date()) {
  return isBookingActive(booking) && !hasBookingEnded(booking, now);
}

/** The client can cancel their own booking while it is active and has not started yet. */
export function canClientCancel(booking) {
  return isBookingActive(booking) && !hasBookingStarted(booking);
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
    .filter((booking) => isBookingAhead(booking))
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

/**
 * One plain sentence about how long a waiting request has, for the client: by when the salon /
 * artist answers and what happens if they don't (cancelled, or sent to the backup salon), or for a
 * request with no window, that it waits until the appointment and the client may cancel it. "" when
 * the request isn't waiting or nothing can be said.
 */
export function requestWaitNote(booking, now = new Date()) {
  if (!["درخواست", "تازه"].includes(booking?.status)) return "";
  const who = booking.bookingSource === "artist" ? "آرتیست" : "سالن";
  const windowMinutes = bookingWaitMinutes(booking);
  if (windowMinutes === null) return `${who} تا قبل از نوبت (حداکثر ۲۴ ساعت) وقت دارد جواب بدهد. اگر دیر شد، خودت لغوش کن.`;
  const deadline = requestDeadlineLabel(booking.created_at || booking.createdAt, booking.booking_date || booking.date, booking.time, { now, windowMinutes });
  if (!deadline) return "";
  const backup = booking.fallback_name || "";
  return backup
    ? `${who} تا ساعت ${deadline} جواب می‌دهد؛ وگرنه می‌رود برای ${backup}.`
    : `${who} تا ساعت ${deadline} جواب می‌دهد؛ وگرنه لغو می‌شود.`;
}

/** For a request that went unanswered and was sent on to the client's backup salon / artist: its name. */
export function movedToName(booking) {
  if (!booking?.moved_to_booking_id) return "";
  return booking.moved_to_name || (booking.bookingSource === "artist" ? "آرتیست دوم" : "سالن دوم");
}
