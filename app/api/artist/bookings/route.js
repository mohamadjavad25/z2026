import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, validateBody } from "../../../lib/http.js";
import * as artists from "../../../lib/db/repos/artists.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { sendPushToUser } from "../../../lib/push.js";
import { createBookingSchema } from "../../../lib/validation/booking.js";
// Side-effect import: starts the once-per-process 1-hour booking-request
// auto-expiry sweep (see that file's docstring) the first time this route
// module loads — same self-starting-on-import convention as
// app/lib/rateLimit.js's sweep, and the exact same import POST /api/salon-bookings
// already does. This is the busiest DIRECT-artist-booking entry point (a
// client booking an independent artist straight, no salon involved), so the
// sweep starts within seconds of real use even if no salon booking ever
// triggers it first.
import "../../../lib/bookingExpirySweep.js";

export const runtime = "nodejs";

export async function POST(request) {
  await ensureDb();
  const body = await request.json();
  const artistUserId = Number(body.artistUserId);
  if (!artistUserId) return error("آرتیست نامعتبر است.", 400);

  // Per-target throttle: this route deliberately allows anonymous booking
  // (no session required, see viewer below), so there is no caller identity
  // to key a limiter by -- keyed on the artist being booked instead, so one
  // artist's calendar can't be flooded with spam bookings by a scripted
  // caller hammering this endpoint, logged in or not. Same in-memory
  // limiter/pattern this codebase already uses elsewhere (see
  // /api/auth/login, /api/salon-bookings).
  const bookingLimited = checkRateLimit(`artist-booking-create:${artistUserId}`, 20, 60_000);
  if (!bookingLimited.ok) {
    return error("درخواست‌های زیاد. کمی صبر کن.", 429);
  }

  // Validated/stripped body -- zod drops any unlisted key (in particular
  // `status`), so this fully anonymous, unauthenticated route can never be
  // used to create a pre-confirmed booking by including
  // "status": "تایید شده" in the request.
  const v = validateBody(createBookingSchema, body);
  if (!v.ok) return v.response;

  const viewer = await getUserFromRequest(request);
  const result = await artists.addArtistBooking(artistUserId, {
    ...v.data,
    clientUserId: viewer?.id || null,
    clientName: body.clientName || viewer?.name || "",
    clientPhone: body.clientPhone || viewer?.phone || ""
  });
  if (!result.ok) {
    return json({ error: result.error, code: result.code }, { status: result.code === "SLOT_TAKEN" ? 409 : 400 });
  }

  if (viewer?.id && viewer.id !== artistUserId) {
    void sendPushToUser(artistUserId, {
      title: "درخواست نوبت جدید",
      body: `${result.booking.client || result.booking.client_name || "مشتری"} — ${result.booking.service || ""}`.trim()
    });
  }

  return json({
    data: {
      booking: result.booking,
      bookedSlots: await artists.listArtistBookedSlots(artistUserId)
    }
  }, { status: 201 });
}
