import { toPersianDigits } from "./digits";

// JS getDay(): 0 = Sunday ... 6 = Saturday; hours rows are keyed by the Persian weekday name.
const PERSIAN_WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

/**
 * Today's status from a salon's or artist's weekly hours rows
 * ({ day, active, open_time, close_time }).
 * @returns {{ open: boolean, label: string } | null} null when no hours are set
 */
export function todayStatus(hours, now = new Date()) {
  if (!Array.isArray(hours) || !hours.length) return null;
  const row = hours.find((item) => item.day === PERSIAN_WEEKDAYS[now.getDay()]);
  if (!row?.active) return { open: false, label: "امروز تعطیل" };
  return { open: true, label: row.close_time ? `باز تا ${toPersianDigits(row.close_time)}` : "امروز باز" };
}
