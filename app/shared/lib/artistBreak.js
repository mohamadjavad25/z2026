import { toLatinDigits } from "./digits.js";
import { PERSIAN_WEEKDAYS, getPersianWeekday, persianDateKeyToDate, persianWeekdayIndex } from "./persianCalendar.js";

/**
 * An artist's break (owner's decision 2026-11-02): one daily window on the weekdays that are switched on, and
 * «الان استراحت می‌کنم» (15, 30 or 60 minutes, today only). Shape everywhere, server and page:
 *   { start, end, days: [0..6], now: { date, start, end } | null }
 * `start`/`end` are "" when only a «now» break exists; `days` are weekday indexes (0 = شنبه … 6 = جمعه).
 * Everything that asks «is this hour free?» reads it through breakRangesOn, so the server's check, the artist's
 * page, the owner's booking form, the waitlist and the story times never disagree.
 */
export const ALL_BREAK_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const BREAK_NOW_MINUTES = [15, 30, 60];

function minutesOf(value) {
  const [hours = "0", minutes = "0"] = toLatinDigits(String(value || "")).split(":");
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

/** Weekday index (0 = شنبه) of a date key like "1405-08-11"; -1 when it is not a date key. */
export function weekdayOfDateKey(dateKey) {
  const date = persianDateKeyToDate(dateKey);
  return date ? persianWeekdayIndex(getPersianWeekday(date)) : -1;
}

/** The weekday list as stored: a string of digits ("0123456"), cleaned and sorted. */
export function cleanBreakDays(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split("");
  return [...new Set(list.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

/** Whether the daily window is set (start before end). */
export function hasDailyBreak(breakTime) {
  return Boolean(breakTime?.start && breakTime?.end) && minutesOf(breakTime.end) > minutesOf(breakTime.start);
}

/** The «now» break when it is for `todayKey`, else null. */
export function activeNowBreak(breakTime, todayKey) {
  const now = breakTime?.now;
  if (!now?.date || now.date !== todayKey) return null;
  return minutesOf(now.end) > minutesOf(now.start) ? now : null;
}

/** The minute ranges the break holds on `dateKey`: the daily window when that weekday is on, and today's «now» break. */
export function breakRangesOn(breakTime, dateKey) {
  if (!breakTime) return [];
  const ranges = [];
  if (hasDailyBreak(breakTime)) {
    const days = Array.isArray(breakTime.days) ? breakTime.days : ALL_BREAK_DAYS;
    const weekday = weekdayOfDateKey(dateKey);
    // A day that cannot be told (not a date key) keeps the old rule: the window holds every day.
    if (weekday < 0 || days.includes(weekday)) ranges.push({ start: minutesOf(breakTime.start), end: minutesOf(breakTime.end) });
  }
  const now = breakTime.now;
  if (now?.date && now.date === dateKey && minutesOf(now.end) > minutesOf(now.start)) {
    ranges.push({ start: minutesOf(now.start), end: minutesOf(now.end) });
  }
  return ranges;
}

/** «شنبه تا پنجشنبه», «هر روز», or the days one by one: how the banner names the days of the daily window. */
export function breakDaysText(days) {
  const list = cleanBreakDays(days ?? ALL_BREAK_DAYS);
  if (list.length === 7) return "هر روز";
  if (!list.length) return "هیچ روزی";
  const run = list.every((day, index) => index === 0 || day === list[index - 1] + 1);
  if (run && list.length >= 3) return `${PERSIAN_WEEKDAYS[list[0]]} تا ${PERSIAN_WEEKDAYS[list[list.length - 1]]}`;
  return list.map((day) => PERSIAN_WEEKDAYS[day]).join("، ");
}
