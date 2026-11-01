import { minutesUntilSlotStart } from "../../shared/lib/bookingWindow.js";
import { toAsciiDigits, toPersianDigits } from "../../shared/lib/digits.js";
import { formatPersianDateKey } from "../../shared/lib/persianCalendar.js";

/**
 * The story's choices that need no screen (owner's rules 2026-11-01), kept pure so every rule is tested:
 * frfro only suggests, the salon or artist decides. Cancelled bookings play no part (owner: «کاری به لغو شده‌ها
 * نداشته باشیم»); a free time is simply free.
 *
 * - A story shows at most two days, picked from today, tomorrow and the day after.
 * - Up to four times a day; the suggestion spreads them over the day (morning, midday, evening), never four in a row.
 * - A time less than an hour away is never suggested and never on the home card.
 *
 * `days` everywhere: [{ label: "امروز" | "فردا" | "پس‌فردا", key: "1405-08-11", times: ["11:00", …] }].
 */

export const STORY_MAX_DAYS = 2;
export const STORY_TIMES_PER_DAY = 4;
export const NEAR_MINUTES = 60;

/** "8:5" → "", "8:05" and "۰۸:۰۵" → "08:05". */
export function clock(value) {
  const match = toAsciiDigits(String(value || "")).match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

/** The day's times without the ones less than an hour away (only today has those), as "HH:MM", in order, once each. */
export function usableTimes(day, now = new Date()) {
  const seen = new Set();
  return (day?.times || [])
    .map(clock)
    .filter((time) => {
      if (!time || seen.has(time)) return false;
      seen.add(time);
      // By the day's own key, not its label, so a list read just before midnight is still right after it.
      const left = minutesUntilSlotStart(day.key, time, now);
      return left !== null && left >= NEAR_MINUTES;
    })
    .sort();
}

/** Up to `count` times spread evenly from first to last (first and last always in), in order. */
export function spreadTimes(times, count = STORY_TIMES_PER_DAY) {
  const list = [...new Set((times || []).map(clock).filter(Boolean))].sort();
  if (list.length <= count) return list;
  if (count <= 1) return list.slice(0, Math.max(0, count));
  const picked = new Set();
  for (let i = 0; i < count; i += 1) picked.add(Math.round((i * (list.length - 1)) / (count - 1)));
  return [...picked].sort((a, b) => a - b).map((index) => list[index]);
}

/** The days a new story starts with: the first two that still have a usable time. */
export function suggestDays(days, now = new Date()) {
  return (days || []).filter((day) => usableTimes(day, now).length).slice(0, STORY_MAX_DAYS).map((day) => day.key);
}

/** The times a new story starts with, by day key, for the suggested days. */
export function suggestTimes(days, now = new Date()) {
  const keys = new Set(suggestDays(days, now));
  return Object.fromEntries((days || []).filter((day) => keys.has(day.key)).map((day) => [day.key, spreadTimes(usableTimes(day, now))]));
}

/**
 * Turns a day on or off. A third day replaces the one picked first, so two stay on and nobody hits a wall.
 * Returns the new list of day keys, in calendar order.
 */
export function toggleDay(onDays, key, order) {
  const list = [...(onDays || [])];
  if (list.includes(key)) return list.filter((k) => k !== key);
  const next = list.length >= STORY_MAX_DAYS ? [...list.slice(1), key] : [...list, key];
  const rank = (k) => { const i = (order || []).indexOf(k); return i < 0 ? Infinity : i; };
  return next.sort((a, b) => rank(a) - rank(b));
}

/** A time on or off for one day; a fifth time is refused (the list comes back unchanged). */
export function toggleTime(onTimes, time) {
  const list = (onTimes || []).map(clock);
  const t = clock(time);
  if (list.includes(t)) return list.filter((x) => x !== t);
  if (list.length >= STORY_TIMES_PER_DAY) return list;
  return [...list, t].sort();
}

/**
 * The calm card on the owner's home, or null: «امروز ۳ وقت خالی داری» (today first, else tomorrow). Nothing once a
 * story was made today: the card is a reminder, not a nag.
 */
export function buildSuggestion({ days = [], postedToday = false, now = new Date() }) {
  if (postedToday) return null;
  const today = formatPersianDateKey(now);
  const tomorrow = formatPersianDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  for (const [key, label] of [[today, "امروز"], [tomorrow, "فردا"]]) {
    const day = days.find((d) => d.key === key);
    const count = day ? usableTimes(day, now).length : 0;
    if (count) return { when: label, count, title: `${label} ${toPersianDigits(count)} وقت خالی داری` };
  }
  return null;
}
