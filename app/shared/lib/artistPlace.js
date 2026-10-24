import { findSalonHourForWeekday, isSalonHourOpen, normalizeWeekdayName, salonDayWindow, weekdayOfDateKey } from "./salonAvailability.js";
import { minutesToPersianTime, timeLabelToMinutes } from "./time.js";

/**
 * Where a client who books an artist on a salon team is received (owner's idea of 2026-10-24): the artist chooses,
 * the salon keeps one switch. One pure place for the rules, used by the server (bookings, public page, the artist's
 * own screen) and by the booking screens, so what is shown is what the server will accept.
 *
 *  - the artist's choice: 'own' (their own place; what always happened before), 'salon', or 'days' (one letter per
 *    weekday from شنبه to جمعه: 's' at the salon, 'o' at their own place);
 *  - the place of one day, after the salon's side is taken into account:
 *      'own'     the artist's own place;
 *      'salon'   at the salon, inside the hours both the artist and the salon are open;
 *      'closed'  the artist chose the salon but the salon is closed that day;
 *      'away'    the artist chose the salon but is not there that day (on leave or switched off in the salon's team,
 *                or the two sets of hours never meet);
 *      'blocked' the artist chose the salon but the salon switched «نوبت مستقیم توی سالن» off for them.
 */

export const PLACE_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
export const PLACE_MODES = ["own", "salon", "days"];
export const DEFAULT_PLACE_DAYS = "ooooooo";
const AWAY_STATES = new Set(["غیرفعال", "مرخصی"]);

export function isPlaceDays(value) {
  return typeof value === "string" && /^[so]{7}$/.test(value);
}

/** The seven letters the artist's choice means: ['s' | 'o' x 7] from شنبه to جمعه. */
export function plannedPlaces(mode, days = DEFAULT_PLACE_DAYS) {
  if (mode === "salon") return Array(7).fill("s");
  if (mode === "days" && isPlaceDays(days)) return days.split("");
  return Array(7).fill("o");
}

/** Index 0..6 (شنبه..جمعه) of a weekday name or of a Persian date key; -1 when it is neither. */
export function placeWeekdayIndex(value) {
  const name = normalizeWeekdayName(weekdayOfDateKey(value) || value);
  return PLACE_WEEKDAYS.findIndex((day) => normalizeWeekdayName(day) === name);
}

/** The window two rows share (null when they never meet): both must be open, from the later opening to the earlier closing. */
function sharedWindow(a, b) {
  const first = salonDayWindow(a);
  const second = salonDayWindow(b);
  const open = Math.max(timeLabelToMinutes(first.open), timeLabelToMinutes(second.open));
  const close = Math.min(timeLabelToMinutes(first.close), timeLabelToMinutes(second.close));
  return close > open ? { open, close } : null;
}

/**
 * The seven places and the hours a client may book on each, from: the artist's choice, the artist's own hours rows,
 * the salon's hours rows, whether the salon allows direct bookings and the member's state in the team.
 * → [{ day, kind, open_time, close_time, active }] in شنبه..جمعه order. A day that cannot be booked is inactive.
 */
export function resolveWeek({ mode = "own", days = DEFAULT_PLACE_DAYS, artistHours = [], salonHours = [], allowed = true, state = "فعال" } = {}) {
  const planned = plannedPlaces(mode, days);
  const away = AWAY_STATES.has(String(state || "").trim());
  return PLACE_WEEKDAYS.map((day, index) => {
    const own = findSalonHourForWeekday(artistHours, day);
    const ownOpen = isSalonHourOpen(own);
    const ownWindow = salonDayWindow(own);
    if (planned[index] !== "s") {
      return { day, kind: "own", open_time: ownWindow.open, close_time: ownWindow.close, active: ownOpen };
    }
    const closedRow = { day, open_time: "", close_time: "", active: false };
    if (!allowed) return { ...closedRow, kind: "blocked" };
    const salon = findSalonHourForWeekday(salonHours, day);
    if (!isSalonHourOpen(salon)) return { ...closedRow, kind: "closed" };
    if (away || !ownOpen) return { ...closedRow, kind: "away" };
    const shared = sharedWindow(own, salon);
    if (!shared) return { ...closedRow, kind: "away" };
    return { day, kind: "salon", open_time: minutesToPersianTime(shared.open), close_time: minutesToPersianTime(shared.close), active: true };
  });
}

/** The row of `resolveWeek` for a weekday name or a Persian date key, or null. */
export function placeOfDay(week, value) {
  const index = placeWeekdayIndex(value);
  return index >= 0 && Array.isArray(week) ? week[index] || null : null;
}

/** What a client reads when a day cannot be booked, by the place's kind. `name` is the artist's, `salonName` the salon's. */
export function placeRefusal(kind, { name = "آرتیست", salonName = "سالن" } = {}) {
  if (kind === "closed") return "این روز سالن تعطیله. روز دیگه‌ای انتخاب کن.";
  if (kind === "away") return `${name} این روز توی ${salonName} نیست. روز دیگه‌ای انتخاب کن.`;
  if (kind === "blocked") return `${salonName} نوبت مستقیم رو بسته. از خود سالن رزرو کن.`;
  return "";
}
