import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, validateBody, withErrorHandling, readObjectBody } from "../../../lib/http.js";
import * as artists from "../../../lib/db/repos/artists.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { checkRateLimit, clientIp } from "../../../lib/rateLimit.js";
import { LOGIN_TO_BOOK_MESSAGE } from "../../../lib/artistBookingCreate.js";
import { bookingWhen, smsNewBookingRequest } from "../../../lib/bookingSms.js";
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
  if (!artistUserId) return error("این آرتیست رو پیدا نکردیم.", 400);

  // Booking an independent artist needs a login (owner's decision 2026-10-22): the client's name and number come
  // from the signed-in account, never from the body, so nobody can book in a stranger's name or into a victim's list.
  const viewer = await getUserFromRequest(request);
  if (!viewer?.id) {
    // No account to key a throttle by: a guest's refusals are counted per address, so a bot cannot use up anything real people share.
    const guestLimited = await checkRateLimit(`artist-booking-guest:${clientIp(request)}`, 30, 60_000);
    if (!guestLimited.ok) return error("یه کم زیاد زدی؛ چند لحظه صبر کن.", 429);
    return error(LOGIN_TO_BOOK_MESSAGE, 401);
  }
  // Per-account throttle (not per artist: one bot must not be able to lock everybody else out of an artist).
  const bookingLimited = await checkRateLimit(`artist-booking-create:user:${viewer.id}`, 20, 60_000);
  if (!bookingLimited.ok) {
    return error("یه کم زیاد زدی؛ چند لحظه صبر کن.", 429);
  }
  // Only the artist (for their own walk-in customers) or a client may create an entry.
  if (viewer.id !== artistUserId && viewer.type !== "client") {
    return error("با حساب مشتری می‌شه از آرتیست نوبت گرفت.", 403);
  }

  // Validated/stripped body -- zod drops any unlisted key (in particular
  // `status`), so this fully anonymous, unauthenticated route can never be
  // used to create a pre-confirmed booking by including
  // "status": "تایید شده" in the request.
  const v = validateBody(createBookingSchema, body);
  if (!v.ok) return v.response;

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

  // A repeated tap on the same request is answered with the request already made, and the artist is not told twice.
  if (viewer?.id && viewer.id !== artistUserId && !result.duplicate) {
    const confirmed = result.booking.status === "تایید شده";
    const push = sendPushToUser(artistUserId, {
      title: result.placeAsk ? "درخواست تازه، جاش رو بگو" : confirmed ? "نوبت تازه (خودکار تأیید شد)" : "درخواست تازه",
      body: `${result.booking.client || result.booking.client_name || "مشتری"}، ${result.booking.service || "نوبت"}، ${bookingWhen(result.booking.booking_date || result.booking.bookingDate, result.booking.time)}`
    }).catch(() => null);
    // A request waiting for the artist's answer must reach them in time, even where push does not.
    if (!confirmed) {
      smsNewBookingRequest(artistUserId, {
        client: result.booking.client || result.booking.client_name,
        service: result.booking.service,
        bookingDate: result.booking.booking_date || result.booking.bookingDate,
        time: result.booking.time,
        fromUserId: viewer.id
      }, push);
    }
  }

  return json({
    data: {
      booking: result.booking,
      bookedSlots: await artists.listArtistBookedSlots(artistUserId)
    }
  }, { status: result.duplicate ? 200 : 201 });
}

export const POST = withErrorHandling(_POST);
