import { persianDateKeyToDate } from "./persianCalendar.js";
import { getTehranClockMinutes, timeLabelToMinutes } from "./time.js";
import { nowDate } from "./clock.js";

/** Iran has no daylight saving: Tehran is a fixed UTC+03:30. */
const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30;
const DAY_WINDOW_MINUTES = 24 * 60;
const SOON_WINDOW_MINUTES = 2 * 60;
// Owner's decision of 2026-11-08: a visit before 8:00 is reminded the evening before (20:00 to 22:00), not at 4 or 5 a.m.
const EARLY_VISIT_BEFORE = 8 * 60;
const EVENING_FROM = 20 * 60;
const EVENING_UNTIL = 22 * 60;

/** The instant (epoch ms) a booking starts, from its stored Persian date key and "HH:MM" time. null when unreadable. */
export function bookingStartMs(dateKey, time, now = nowDate()) {
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
export function eveningForEarlyVisit(kind, time, now = nowDate()) {
  if (kind !== "day" || timeLabelToMinutes(time) >= EARLY_VISIT_BEFORE) return kind;
  const clock = getTehranClockMinutes(now);
  // Held for the evening: sending the day reminder at 8 and the same words again at 20 was a second text for one visit.
  if (clock >= EVENING_FROM && clock < EVENING_UNTIL) return "evening";
  return clock < EVENING_FROM ? null : kind;
}

export function dueReminderKind(dateKey, time, now = nowDate()) {
  const start = bookingStartMs(dateKey, time, now);
  if (start === null) return null;
  const minutesUntil = (start - now.getTime()) / 60000;
  if (minutesUntil <= 0) return null;
  if (minutesUntil <= SOON_WINDOW_MINUTES) return "soon";
  if (minutesUntil <= DAY_WINDOW_MINUTES) return "day";
  return null;
}
