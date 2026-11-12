import { bookingStartMs } from "../../shared/lib/reminderTiming.js";
import { formatPersianDateKey, getPersianDateParts, getPersianWeekday } from "../../shared/lib/persianCalendar.js";
import { nowDate, nowMs } from "../../shared/lib/clock.js";
import { toPersianDigits } from "../../shared/lib/digits.js";

/**
 * The day and hour a client asks a salon that is not on frfro yet (contact requests, owner 2026-11-12). frfro does
 * not know that salon's hours, so the client picks freely: the next two weeks, 8 to 21 on the hour, and nothing
 * closer than LEAD_HOURS (the request closes then, db/repos/contactRequests.js).
 */
export const LEAD_HOURS = 3;
const DAYS = 14;
const FIRST_HOUR = 8;
const LAST_HOUR = 21;

const SHORT_WEEKDAY = { "شنبه": "شنبه", "یکشنبه": "یک", "دوشنبه": "دو", "سه‌شنبه": "سه", "چهارشنبه": "چهار", "پنجشنبه": "پنج", "جمعه": "جمعه" };

/** [{ key, top, day }] for the next two weeks; `top` is «امروز», «فردا» or a short weekday. */
export function requestDays(now = nowDate()) {
  const days = [];
  for (let i = 0; i < DAYS; i += 1) {
    const date = new Date(now.getTime() + i * 86400_000);
    const weekday = getPersianWeekday(date);
    days.push({
      key: formatPersianDateKey(date),
      top: i === 0 ? "امروز" : i === 1 ? "فردا" : SHORT_WEEKDAY[weekday] || weekday,
      day: toPersianDigits(getPersianDateParts(date).day)
    });
  }
  return days;
}

/** [{ time: "HH:00", label, open }] for a day; `open` is false for an hour under LEAD_HOURS away. */
export function requestHours(dayKey, now = nowMs()) {
  const hours = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
    const time = `${String(hour).padStart(2, "0")}:00`;
    const start = bookingStartMs(dayKey, time, new Date(now));
    hours.push({ time, label: toPersianDigits(`${hour}:00`), open: Boolean(start) && start - now >= LEAD_HOURS * 3600_000 });
  }
  return hours;
}

/** The first day that still has an open hour (today late in the evening has none). */
export function firstOpenDay(days, now = nowMs()) {
  return days.find((day) => requestHours(day.key, now).some((hour) => hour.open))?.key || days[0]?.key || "";
}

// While the phone's contact list is open Android may close frfro (contactPicker.js); the request being made waits
// here so it is finished after the restart.
const DRAFT_KEY = "frfro:request-draft";
const DRAFT_MS = 10 * 60 * 1000;

export function saveRequestDraft(draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, at: Date.now() }));
  } catch {
    // without storage a lost pick is just started again
  }
}

export function takeRequestDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    localStorage.removeItem(DRAFT_KEY);
    return draft && Date.now() - Number(draft.at) < DRAFT_MS && draft.service?.name ? draft : null;
  } catch {
    return null;
  }
}
