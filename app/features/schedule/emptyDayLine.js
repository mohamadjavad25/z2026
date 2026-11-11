/**
 * The line under the mascot on a day with no bookings. Two lines take turns (owner, 2026-11-11: «یه سری وقتا این،
 * یه سری وقتا همین چیزی که الان هست»): the tea one and a plain one. The pick follows the day's own name, so the same
 * day and calendar date always say the same thing (nothing flickers when the screen redraws), and «امروز» turns from
 * one line to the other from one date to the next.
 */
import { nowDate } from "../../shared/lib/clock.js";

const LINES = [
  (day) => `«${day}» نوبتی نداری؛ وقت یه چایی‌ه`,
  (day) => `«${day}» نوبتی نیست`
];

export function emptyDayLine(dayLabel) {
  const day = String(dayLabel || "امروز");
  let sum = nowDate().getDate();
  for (const char of day) sum += char.charCodeAt(0);
  return LINES[sum % LINES.length](day);
}
