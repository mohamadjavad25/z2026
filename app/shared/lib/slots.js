import { formatPersianDateKey, resolveRollingPersianDateKey } from "./persianCalendar.js";
import { getTehranClockMinutes, timeLabelToMinutes } from "./time.js";

/** True when `day` (a label such as "امروز" or a date key) is today and `time` has already started. */
export function isSlotInPast(day, time, now = new Date()) {
  const key = resolveRollingPersianDateKey(day, now);
  if (!key) return false;
  const todayKey = formatPersianDateKey(now);
  if (key < todayKey) return true;
  if (key > todayKey) return false;
  return timeLabelToMinutes(time) <= getTehranClockMinutes(now);
}
