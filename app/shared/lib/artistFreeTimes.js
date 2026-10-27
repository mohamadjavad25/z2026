import { buildPublicBookingSlots, isPublicArtistSlotBlocked } from "../../features/artist/bookingUtils.js";
import { isTooSoonToRequest } from "./bookingWindow.js";
import { buildDayBookingSlots } from "./time.js";
import { resolveRollingPersianDateKey } from "./persianCalendar.js";
import { findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "./salonAvailability.js";
import { salonTimeBlock, workplaceOn } from "./artistPlace.js";

/** The day strip holds labels ("شنبه ۲ آبان"); hours and places are looked up by the real date. */
const dateKeyOf = (day) => resolveRollingPersianDateKey(day) || day;

/**
 * The 30-minute start times of one day that fit the artist's hours (the default week when none are known) and, when
 * the artist works at a salon that day, the salon's hours too (shared/lib/artistPlace.js; the server refuses the rest).
 */
export function slotsInHours(artist, day, durationMinutes) {
  const rows = Array.isArray(artist?.hours) && artist.hours.length ? artist.hours : null;
  let slots;
  if (!rows) slots = buildPublicBookingSlots(durationMinutes);
  else {
    const row = findSalonHourForDateKey(rows, dateKeyOf(day));
    if (!isSalonHourOpen(row)) return [];
    const window = salonDayWindow(row);
    slots = buildDayBookingSlots(window.open, window.close, durationMinutes);
  }
  const salon = workplaceOn(artist?.workplaces, dateKeyOf(day));
  return salon ? slots.filter((slot) => !salonTimeBlock(salon.hours, dateKeyOf(day), slot, durationMinutes)) : slots;
}

/**
 * The times a client can ask an independent artist for on `day` for a visit `durationMinutes` long, from the artist's
 * public data (hours, workplaces, break, booked slots): what the artist's booking panel offers, and what «خبرم کن»
 * checks when a time frees up.
 */
export function artistFreeTimes(artist, day, durationMinutes) {
  return slotsInHours(artist, day, durationMinutes).filter(
    (slot) => !isTooSoonToRequest(day, slot) && !isPublicArtistSlotBlocked(artist, day, slot, durationMinutes)
  );
}
