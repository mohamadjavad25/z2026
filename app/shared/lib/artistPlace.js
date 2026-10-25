import { findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "./salonAvailability.js";
import { formatPersianDateKey } from "./persianCalendar.js";
import { timeLabelToMinutes } from "./time.js";

/**
 * Where an artist's own clients are received (owner's decision of 2026-10-25). One place at a time: the artist's
 * «محل کار», a salon whose team they are on, or their own place. The artist can say "from this day on I work at …", so
 * the place is a short schedule: [{ from: "1405-08-04", salon: { id, name, area, hours, … } | null }], oldest first,
 * where an entry holds from its day until the next entry's day (salon null = the artist's own place). The server builds
 * it (db/repos/artistPlace.js), the public page and the server read it through the same helpers below, so what a client
 * is offered is exactly what the server accepts.
 */

/** Today's Persian date key, `days` later when given (Tehran calendar, like booking_date). */
export function dateKeyAfter(days = 0, from = new Date()) {
  return formatPersianDateKey(new Date(from.getTime() + Number(days || 0) * 86400000));
}

/** The entry of the schedule that holds on `dateKey`, or null (the artist's own place) when none does. */
export function workplaceOn(schedule, dateKey) {
  let found = null;
  for (const entry of Array.isArray(schedule) ? schedule : []) {
    if (String(entry?.from || "") <= String(dateKey || "")) found = entry;
  }
  return found?.salon || null;
}

/**
 * Whether a booking of `minutes` at `time` on `dateKey` fits a salon's weekly hours: '' when it does, 'closed' when the
 * salon is closed that weekday, 'outside' when it starts before it opens or ends after it closes. The artist's own hours
 * are checked separately; a bookable hour is one inside both (owner's decision of 2026-10-25).
 */
export function salonTimeBlock(hours, dateKey, time, minutes = 60) {
  const row = findSalonHourForDateKey(Array.isArray(hours) ? hours : [], dateKey);
  if (!isSalonHourOpen(row)) return "closed";
  const window = salonDayWindow(row);
  const start = timeLabelToMinutes(time);
  if (start < timeLabelToMinutes(window.open) || start + Math.max(15, Number(minutes) || 60) > timeLabelToMinutes(window.close)) return "outside";
  return "";
}

/** The refusal the server gives and the client shows when the hour falls outside the workplace salon's hours. */
export function salonClosedMessage(salonName = "سالن") {
  return `${salonName} این ساعت بسته‌ست. یه ساعت دیگه بزن.`;
}
