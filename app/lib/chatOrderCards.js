import { getOrderById } from "./db/repos/shops.js";
import { getSalonBookingById } from "./db/repos/salons.js";
import { getArtistBookingById } from "./db/repos/artists.js";

/**
 * Attaches a live order snapshot (status, items, price, image) to every
 * "order card" message in `messageList` — the card must never cache/store
 * its own copy of the status, or it'd go stale the moment the shop updates
 * the order. Mutates each message object in place and returns the list.
 */
export function enrichOrderCards(messageList) {
  for (const message of messageList) {
    if (message.attachmentType === "order" && message.orderRefId) {
      message.order = getOrderById(message.orderRefId);
    }
  }
  return messageList;
}

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
  enrichOrderCards(messageList);
  enrichBookingCards(messageList);
  return messageList;
}
