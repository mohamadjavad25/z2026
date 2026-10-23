import { resolveRollingPersianDateKey } from "../../shared/lib/persianCalendar.js";
import { parseBookingTime } from "../../shared/lib/time.js";

const DIGIT = "[\\d۰-۹٠-٩０-９]";
const LOOKS_LIKE_DATE = new RegExp(`^[\\d۰-۹٠-٩０-９\\s\\-/.]+$`);
const CANONICAL_DATE = new RegExp(`^${DIGIT}{4}-${DIGIT}{2}-${DIGIT}{2}$`);

/**
 * The day a caller sent, as the canonical "YYYY-MM-DD" key, or "" when it can't be trusted. A written date must
 * be exactly YYYY-MM-DD (two-digit month and day, dashes) and a REAL Jalali day; "امروز", "فردا", "پس‌فردا" and
 * weekday names are resolved to today's key as before. Slashes, dots, missing zeros and Gregorian dates are
 * refused here (the calendar helper reads them forgivingly, but a booking API must not guess).
 */
export function strictDayKey(raw) {
  const text = String(raw ?? "").trim();
  if (LOOKS_LIKE_DATE.test(text) && !CANONICAL_DATE.test(text)) return "";
  return resolveRollingPersianDateKey(text);
}

/**
 * The day and clock time of a booking request, read strictly. The day is today / tomorrow / a weekday name / a
 * REAL Jalali date (not an impossible one, not a Gregorian one, not further out than about a year); the time is a
 * real "HH:MM". Nothing is guessed: unreadable input is refused instead of turning into "today" or "00:00".
 * `rawDay` / `rawTime` are what the caller sent. → { ok: true, dateKey, time } or { ok: false, status: 400, error }.
 */
export function readBookingSlot(rawDay, rawTime) {
  if (typeof rawDay !== "string" || !rawDay.trim()) return { ok: false, status: 400, error: "یه روز انتخاب کن." };
  if (typeof rawTime !== "string" || !rawTime.trim()) return { ok: false, status: 400, error: "یه ساعت انتخاب کن." };
  const dateKey = strictDayKey(rawDay);
  if (!dateKey) return { ok: false, status: 400, error: "این روز رو نفهمیدیم؛ دوباره انتخاب کن." };
  const time = parseBookingTime(rawTime);
  if (!time) return { ok: false, status: 400, error: "ساعت رو این‌جوری بنویس: ۱۴:۳۰" };
  return { ok: true, dateKey, time };
}
