import { resolveRollingPersianDateKey, formatPersianDateKey } from "./persianCalendar.js";
import { toPersianDigits } from "./digits.js";
import { getTehranClockMinutes, timeLabelToMinutes, toIsoLikeTimestamp } from "./time.js";

/**
 * One source of truth for how long a client's booking REQUEST can wait for an answer.
 * The expiry sweep (app/lib/bookingExpirySweep.js), the server's "too soon" check and every
 * "respond by" label in the client / salon / artist screens all read from here, so what a screen
 * promises is exactly what the server does.
 *
 * A request waits for the shorter of:
 *  - WINDOW minutes after it was sent, and
 *  - the moment its appointment starts (an answer after that is meaningless).
 * LEAD keeps the second one from squeezing the first: a client may not request a time that starts
 * sooner than LEAD minutes from now, so the owner always gets at least that long to answer.
 */
export const BOOKING_REQUEST_WINDOW_MINUTES = 60;
export const BOOKING_REQUEST_LEAD_MINUTES = 30;

/**
 * The client chooses the window when sending (user's decision 2026-10-18): «فقط ۱ ساعت» (WINDOW
 * minutes, after which the request expires, or moves to the salon they picked as a backup) or
 * «تا هر وقت» (no window: the request waits until its appointment starts, and the client cancels it
 * themselves if it takes too long). Stored per booking as `wait_minutes` (NULL = no window).
 */
export const BOOKING_WAIT_CHOICES = { hour: BOOKING_REQUEST_WINDOW_MINUTES, open: null };

/**
 * The window one booking request carries: minutes, or null when it waits until its appointment.
 * A row from before the choice existed has no `wait_minutes` at all and keeps the old hour.
 */
export function bookingWaitMinutes(booking) {
  const raw = booking?.wait_minutes !== undefined ? booking.wait_minutes : booking?.waitMinutes;
  if (raw === undefined) return BOOKING_REQUEST_WINDOW_MINUTES;
  const minutes = Number(raw);
  return raw !== null && raw !== "" && Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/** Minutes from `now` until the slot starts (negative once started). `null` when the day/time can't be read. */
export function minutesUntilSlotStart(day, time, now = new Date()) {
  // An empty day would read as "today" below; here it means "unknown".
  if (!String(day || "").trim() || !String(time || "").trim()) return null;
  const key = resolveRollingPersianDateKey(day, now);
  if (!key) return null;
  const todayKey = formatPersianDateKey(now);
  if (key < todayKey) return -Infinity;
  if (key > todayKey) return Infinity;
  return timeLabelToMinutes(time) - getTehranClockMinutes(now);
}

/** True when a client may not request this slot any more: it starts in less than LEAD minutes. */
export function isTooSoonToRequest(day, time, now = new Date(), leadMinutes = BOOKING_REQUEST_LEAD_MINUTES) {
  const until = minutesUntilSlotStart(day, time, now);
  return until !== null && until < leadMinutes;
}

/**
 * Minutes an unanswered request has left (rounded; 0 or less = no longer answerable), or `null`
 * when nothing can be worked out. `day`/`time` are the appointment's, both optional: without them
 * only the response window counts. `windowMinutes: null` is a request with no window (it waits
 * until its appointment starts).
 */
export function requestMinutesLeft(createdAt, day, time, { now = new Date(), windowMinutes = BOOKING_REQUEST_WINDOW_MINUTES } = {}) {
  let left = null;
  const iso = toIsoLikeTimestamp(createdAt);
  const created = iso ? new Date(iso).getTime() : NaN;
  if (windowMinutes !== null && Number.isFinite(created)) left = Math.round((created + windowMinutes * 60000 - now.getTime()) / 60000);
  const untilSlot = minutesUntilSlotStart(day, time, now);
  if (untilSlot !== null && Number.isFinite(untilSlot)) left = left === null ? untilSlot : Math.min(left, untilSlot);
  else if (untilSlot === -Infinity) left = Math.min(left ?? 0, 0);
  return left;
}

const deadlineFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" });

/** Wall-clock "HH:MM" (Persian digits, Tehran time) the request stops being answerable; "" when unknown. */
export function requestDeadlineLabel(createdAt, day, time, { now = new Date(), windowMinutes = BOOKING_REQUEST_WINDOW_MINUTES } = {}) {
  const left = requestMinutesLeft(createdAt, day, time, { now, windowMinutes });
  if (left === null) return "";
  const iso = toIsoLikeTimestamp(createdAt);
  const created = iso ? new Date(iso).getTime() : NaN;
  const byWindow = windowMinutes !== null && Number.isFinite(created) ? created + windowMinutes * 60000 : Infinity;
  const untilSlot = minutesUntilSlotStart(day, time, now);
  const bySlot = untilSlot !== null && Number.isFinite(untilSlot) ? now.getTime() + untilSlot * 60000 : Infinity;
  const deadline = Math.min(byWindow, bySlot);
  if (!Number.isFinite(deadline)) return "";
  return toPersianDigits(deadlineFmt.format(new Date(deadline)));
}

/** Share (0..1) of the request's whole waiting time still left, for progress bars. `null` when unknown. */
export function requestRemainingShare(createdAt, day, time, { now = new Date(), windowMinutes = BOOKING_REQUEST_WINDOW_MINUTES } = {}) {
  const iso = toIsoLikeTimestamp(createdAt);
  const created = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(created)) return null;
  // The whole wait is measured from when it was sent, with the slot start as it was then.
  const total = requestMinutesLeft(createdAt, day, time, { now: new Date(created), windowMinutes });
  const left = requestMinutesLeft(createdAt, day, time, { now, windowMinutes });
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(1, left / total));
}

/**
 * How far ahead a client may ask (owner's decision of 2026-10-25): 60 days. Only a client's request; a salon or artist
 * enters any date themselves (a bride booking three months ahead calls the salon).
 */
export const BOOKING_HORIZON_DAYS = 60;
export const TOO_FAR_TEXT = `فعلاً تا ${toPersianDigits(BOOKING_HORIZON_DAYS)} روز جلوتر می‌شه نوبت گرفت. برای بعدش به سالن زنگ بزن.`;

/** True when `day` is more than BOOKING_HORIZON_DAYS after today (Tehran). */
export function isTooFarToRequest(day, now = new Date(), horizonDays = BOOKING_HORIZON_DAYS) {
  const key = resolveRollingPersianDateKey(day, now);
  if (!key) return false;
  return key > formatPersianDateKey(new Date(now.getTime() + horizonDays * 86400000));
}
