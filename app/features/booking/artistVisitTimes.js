import { isSlotInPast } from "../../shared/lib/slots.js";
import { bookingHoldsSlot } from "../../shared/lib/salonAvailability.js";
import { buildPublicBookingSlots, isPublicArtistSlotBlocked } from "../artist/bookingUtils.js";

// A time that starts in the next few minutes can't really be served (the customer isn't there yet,
// the artist is mid-job), so today's list starts a little after "now".
export const ARTIST_BOOKING_LEAD_MINUTES = 15;

/** An independent artist's bookings as the busy list the slot check reads. Cancelled and expired ones hold nothing. */
export function artistBusySlots(bookings) {
  return (Array.isArray(bookings) ? bookings : [])
    .filter(bookingHoldsSlot)
    .map((item) => ({ booking_date: item.date, time: item.time, duration_minutes: item.durationMinutes }));
}

/**
 * The start times an independent artist can enter a customer at on `day` (a date key) for a visit
 * `minutes` long: their day's grid, minus what has started, their break and their other bookings.
 * The server checks the same overlap when the booking is sent.
 */
export function artistVisitTimes({ day, minutes, bookings, bookedSlots, breakTime, leaves = [], now = new Date() }) {
  const soon = new Date(now.getTime() + ARTIST_BOOKING_LEAD_MINUTES * 60_000);
  // A public page already has its busy list in the slot shape (bookedSlots); the owner's own list is mapped first.
  const artist = { breakTime, leaves, bookedSlots: bookedSlots || artistBusySlots(bookings) };
  return buildPublicBookingSlots(minutes).filter((slot) => (
    !isSlotInPast(day, slot, soon) && !isPublicArtistSlotBlocked(artist, day, slot, minutes)
  ));
}
