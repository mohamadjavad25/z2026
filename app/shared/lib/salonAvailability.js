import { getPersianWeekday, isPersianDateKey, persianDateKeyToDate } from "./persianCalendar.js";

/**
 * One source of truth for "is this salon open / is this slot held" so the owner's booking sheet, the
 * client's booking modal and the server (app/api/salon-bookings) all decide the same way.
 */

// Used when a salon has no row at all for a weekday (the server enforces the same window).
export const DEFAULT_SALON_OPEN = "۱۰:۰۰";
export const DEFAULT_SALON_CLOSE = "۲۰:۰۰";

// A cancelled or auto-expired booking no longer holds its slot (same list as the server's SQL).
const RELEASED_STATUSES = new Set(["لغو", "منقضی شده"]);

export function bookingHoldsSlot(booking) {
  return !RELEASED_STATUSES.has(String(booking?.status || "").trim());
}

/** "پنج‌شنبه", "پنجشنبه" and "پنج شنبه" are the same day. */
export function normalizeWeekdayName(value) {
  return String(value || "").replace(/[\s‌‏‎]/g, "");
}

/** Weekday name ("پنجشنبه") of an absolute Persian date key ("1405-07-16"), or "" when it is not one. */
export function weekdayOfDateKey(dateKey) {
  if (!isPersianDateKey(dateKey)) return "";
  const date = persianDateKeyToDate(dateKey);
  if (!date) return "";
  // Noon avoids any timezone edge pushing the date into the neighbouring day.
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  return getPersianWeekday(noon);
}

/** The salon_hours row for a weekday name, or null when the salon has no row for it. */
export function findSalonHourForWeekday(hours, weekday) {
  if (!Array.isArray(hours) || !weekday) return null;
  const wanted = normalizeWeekdayName(weekday);
  return hours.find((hour) => normalizeWeekdayName(hour?.day) === wanted) || null;
}

export function findSalonHourForDateKey(hours, dateKey) {
  return findSalonHourForWeekday(hours, weekdayOfDateKey(dateKey));
}

export function isSalonHourOpen(hour) {
  if (!hour) return true; // no row: open on the default window
  return Boolean(Number(hour.active) || hour.active === true);
}

/** Open/close for a day, falling back to the default window when the row is missing or empty. */
export function salonDayWindow(hour) {
  return {
    open: String(hour?.open_time || "").trim() || DEFAULT_SALON_OPEN,
    close: String(hour?.close_time || "").trim() || DEFAULT_SALON_CLOSE
  };
}

/** Whether a stored booking falls on `dateKey`. Only absolute keys count, exactly like the server's `booking_date = $key`. */
export function bookingIsOnDateKey(booking, dateKey) {
  const raw = String(booking?.booking_date || booking?.date || "").trim();
  return isPersianDateKey(raw) && raw === dateKey;
}
