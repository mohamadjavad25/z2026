import { z } from "zod";

/**
 * POST /api/salon-bookings and POST /api/artist/bookings both used to
 * spread the raw request body into the INSERT (`{ ...body, client, phone,
 * service, ... }`), and the repo layer falls back to `data.status || "تازه"`
 * -- so a caller who simply included `"status": "تایید شده"` in the POST
 * body got a pre-confirmed booking, skipping the salon/artist's approval
 * step entirely. POST /api/artist/bookings doesn't even require a session,
 * so this was exploitable anonymously.
 *
 * Fix: define an explicit allowlist of client-settable fields for booking
 * *creation* with no `status` field at all. zod strips unknown keys from a
 * plain z.object() by default, so parsing through this schema and using
 * the parsed result (not the raw body) to build the repo call removes
 * `status` (and anything else not listed here) automatically -- the server
 * always creates a booking with its own default status.
 */
export const createBookingSchema = z.object({
  salonUserId: z.union([z.string(), z.number()]).optional(),
  artistUserId: z.union([z.string(), z.number()]).optional(),
  client: z.string().trim().max(120).optional(),
  clientName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  clientPhone: z.string().trim().max(30).optional(),
  service: z.string().trim().max(200).optional(),
  staff: z.union([z.string(), z.number()]).optional(),
  bookingDate: z.string().optional(),
  booking_date: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  duration: z.string().optional(),
  durationMinutes: z.union([z.string(), z.number()]).optional(),
  duration_minutes: z.union([z.string(), z.number()]).optional()
});

/** Status values a caller is ever allowed to request through a PATCH --
 *  matches the whitelist already enforced in app/api/salon-bookings/route.js
 *  and app/api/artist/me/route.js's patchOwnArtistBooking; kept here too so
 *  it's defined once and can be reused by future routes/tests instead of
 *  re-typing the literal strings. */
export const PATCHABLE_BOOKING_STATUSES = ["تایید شده", "لغو"];
