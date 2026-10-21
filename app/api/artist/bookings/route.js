import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, validateBody, withErrorHandling, readObjectBody } from "../../../lib/http.js";
import * as artists from "../../../lib/db/repos/artists.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { smsNewBookingRequest } from "../../../lib/bookingSms.js";
import { sendPushToUser } from "../../../lib/push.js";
import { createBookingSchema } from "../../../lib/validation/booking.js";
import { createArtistBooking } from "../../../lib/artistBookingCreate.js";
import { validFallbackArtist } from "../../../lib/bookingFallback.js";
import { BOOKING_WAIT_CHOICES } from "../../../shared/lib/bookingWindow.js";
// Side-effect import: starts the once-per-process booking-request
// auto-expiry sweep (see that file's docstring) the first time this route
// module loads — same self-starting-on-import convention as
// app/lib/rateLimit.js's sweep, and the exact same import POST /api/salon-bookings
// already does. This is the busiest DIRECT-artist-booking entry point (a
// client booking an independent artist straight, no salon involved), so the
// sweep starts within seconds of real use even if no salon booking ever
// triggers it first.
import "../../../lib/bookingExpirySweep.js";

export const runtime = "nodejs";

async function _POST(request) {
  await ensureDb();
  const body = await readObjectBody(request);
  const artistUserId = Number(body.artistUserId);
  if (!artistUserId) return error("آرتیست نامعتبر است.", 400);

  // Per-target throttle: this route deliberately allows anonymous booking
  // (no session required, see viewer below), so there is no caller identity
  // to key a limiter by -- keyed on the artist being booked instead, so one
  // artist's calendar can't be flooded with spam bookings by a scripted
  // caller hammering this endpoint, logged in or not. Same DB-backed
  // limiter/pattern this codebase already uses elsewhere (see
  // /api/auth/login, /api/salon-bookings).
  const bookingLimited = await checkRateLimit(`artist-booking-create:${artistUserId}`, 20, 60_000);
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
  // How long a client's request waits (an hour, or until the appointment) and, with the hour, the
  // backup artist: one the client follows that does the same service.
  await salons.ensureBookingColumns();
  const isRequest = Boolean(viewer?.id) && viewer.id !== artistUserId;
  const waitMinutes = isRequest && v.data.waitMinutes !== undefined ? v.data.waitMinutes : undefined;
  const fallbackArtistUserId = isRequest && waitMinutes === BOOKING_WAIT_CHOICES.hour && v.data.fallbackArtistUserId
    ? await validFallbackArtist(viewer.id, artistUserId, Number(v.data.fallbackArtistUserId), v.data.service)
    : null;
  const result = await createArtistBooking({
    artistUserId,
    viewer,
    data: v.data,
    body,
    wait: { minutes: waitMinutes, fallbackArtistUserId }
  });
  if (!result.ok) {
    return json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
  }

  if (viewer?.id && viewer.id !== artistUserId) {
    void sendPushToUser(artistUserId, {
      title: "درخواست نوبت جدید",
      body: `${result.booking.client || result.booking.client_name || "مشتری"} — ${result.booking.service || ""}`.trim()
    });
    // A request waiting for the artist's answer must reach them in time, even where push does not.
    if (result.booking.status !== "تایید شده") {
      smsNewBookingRequest(artistUserId, {
        client: result.booking.client || result.booking.client_name,
        service: result.booking.service,
        bookingDate: result.booking.booking_date || result.booking.bookingDate,
        time: result.booking.time,
        fromUserId: viewer.id
      });
    }
  }

  return json({
    data: {
      booking: result.booking,
      bookedSlots: await artists.listArtistBookedSlots(artistUserId)
    }
  }, { status: 201 });
}

export const POST = withErrorHandling(_POST);
