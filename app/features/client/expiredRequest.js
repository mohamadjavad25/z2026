import { bookingPeople, parseBookingParts } from "../../shared/lib/bookingParts.js";
import { hasBookingStarted, isPlaceGone } from "./bookingStatus.js";

/**
 * «سالن بی‌جواب» (owner's decision 2026-10-22): a request nobody answered in time (status «منقضی شده») that has not
 * already been sent on to a backup and whose appointment is still to come gets two ways forward.
 * Salon requests only; an unanswered direct artist request keeps its own backup-artist flow.
 */
export function canRetryExpired(booking, now = new Date()) {
  return Boolean(booking)
    && booking.bookingSource !== "artist"
    && booking.status === "منقضی شده"
    && !booking.moved_to_booking_id
    && !isPlaceGone(booking)
    && Boolean(booking.salon_user_id)
    && !hasBookingStarted(booking, now);
}

/** What the request asked for, as names for one person and the head count: { names, people }. */
export function requestedOf(booking) {
  const parts = parseBookingParts(booking?.parts);
  if (parts.length >= 2) {
    const people = bookingPeople(parts);
    return { names: parts.filter((part) => !part.person).map((part) => part.service), people };
  }
  return { names: [String(booking?.service || "").trim()].filter(Boolean), people: 1 };
}

/** The body of a fresh request for the same services, day and time (the server checks everything again). */
export function repeatRequestBody(booking) {
  const { names, people } = requestedOf(booking);
  const durationOf = (name) => `${parseBookingParts(booking.parts).find((part) => part.service === name)?.minutes || 0} دقیقه`;
  return {
    salonUserId: booking.salon_user_id,
    bookingDate: booking.booking_date || booking.date,
    time: booking.time,
    client: booking.client || "",
    phone: booking.phone || "",
    status: "درخواست",
    ...(names.length >= 2
      ? { service: names.join(" + "), parts: names.map((name) => ({ service: name, ...(parseBookingParts(booking.parts).length ? { duration: durationOf(name) } : {}) })) }
      : { service: names[0] || "" }),
    ...(people > 1 ? { people } : {})
  };
}
