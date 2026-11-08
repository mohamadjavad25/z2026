import { toPersianDigits } from "./digits";
import { getTodayPersianWeekday } from "./time";
import { nowDate } from "./clock.js";

/**
 * Today's status from a salon's or artist's weekly hours rows
 * ({ day, active, open_time, close_time }).
 * @returns {{ open: boolean, label: string } | null} null when no hours are set
 */
export function todayStatus(hours, now = nowDate()) {
  if (!Array.isArray(hours) || !hours.length) return null;
  const row = hours.find((item) => item.day === getTodayPersianWeekday(now));
  if (!row?.active) return { open: false, label: "امروز تعطیل" };
  return { open: true, label: row.close_time ? `باز تا ${toPersianDigits(row.close_time)}` : "امروز باز" };
}
