import { persianDateKeyToDate } from "./persianCalendar.js";
import { timeLabelToMinutes } from "./time.js";

/** Iran has no daylight saving: Tehran is a fixed UTC+03:30. */
const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30;
const DAY_WINDOW_MINUTES = 24 * 60;
const SOON_WINDOW_MINUTES = 2 * 60;

/** The instant (epoch ms) a booking starts, from its stored Persian date key and "HH:MM" time. null when unreadable. */
export function bookingStartMs(dateKey, time, now = new Date()) {
  const day = persianDateKeyToDate(dateKey, now);
  if (!day || !String(time || "").includes(":")) return null;
  const minutes = timeLabelToMinutes(time);
  return Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes - TEHRAN_OFFSET_MINUTES);
}

/**
 * Which reminder a booking is due for right now:
 *  - "soon": starts within 2 hours
 *  - "day": starts within 24 hours but more than 2 hours away
 * A booking already in the past, or more than a day away, is due for nothing. A booking made less
 * than 2 hours ahead only ever gets "soon" -- a "see you tomorrow" message would be wrong.
 */
export function dueReminderKind(dateKey, time, now = new Date()) {
  const start = bookingStartMs(dateKey, time, now);
  if (start === null) return null;
  const minutesUntil = (start - now.getTime()) / 60000;
  if (minutesUntil <= 0) return null;
  if (minutesUntil <= SOON_WINDOW_MINUTES) return "soon";
  if (minutesUntil <= DAY_WINDOW_MINUTES) return "day";
  return null;
}
