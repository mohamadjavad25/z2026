import { getSalonBookingById } from "./db/repos/salons.js";
import { getArtistBookingById } from "./db/repos/artists.js";

/**
 * Same idea as enrichOrderCards, for "booking card" messages — attaches a
 * live salon_bookings/artist_bookings snapshot (service, date/time, staff,
 * status) so a booking card never shows a stale status once the salon/artist
 * confirms or cancels it. attachmentType picks which table booking_ref_id
 * points into (see the column comment in schema.js).
 */
export function enrichBookingCards(messageList) {
  for (const message of messageList) {
    if (!message.bookingRefId) continue;
    if (message.attachmentType === "salon-booking") {
      message.booking = getSalonBookingById(message.bookingRefId);
    } else if (message.attachmentType === "artist-booking") {
      message.booking = getArtistBookingById(message.bookingRefId);
    }
  }
  return messageList;
}

/** Runs every card-enrichment pass over one message list — the one callers reading a generic conversation feed should use. */
export function enrichCardMessages(messageList) {
  enrichBookingCards(messageList);
  return messageList;
}
