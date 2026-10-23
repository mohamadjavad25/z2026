import { error, json, notFound, parseId, requireUserRole, withErrorHandling } from "../../../../lib/http.js";
import * as artists from "../../../../lib/db/repos/artists.js";
import { sendPushToUser } from "../../../../lib/push.js";
import { bookingWhen, smsClientCancelled } from "../../../../lib/bookingSms.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";

export const runtime = "nodejs";

/** POST /api/artist-bookings/:id/cancel -- the booking's own client cancels it. */
async function _POST(request, { params }) {
  const auth = await requireUserRole(request, "client", "فقط خود مشتری می‌تونه نوبتش رو لغو کنه.");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const limited = await checkRateLimit(`booking-cancel:${auth.user.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) return error("یه کم زیاد زدی؛ چند لحظه دیگه دوباره بزن.", 429);

  const result = await artists.cancelArtistBookingByClient(id, auth.user);
  if (!result.ok) {
    if (result.error === "missing") return notFound("این نوبت رو پیدا نکردیم.");
    if (result.error === "inactive") return error("این نوبت دیگه فعال نیست.", 409);
    if (result.error === "past") return error("این نوبت گذشته و دیگه لغو نمی‌شه.", 409);
    return error("لغو نشد؛ دوباره بزن.", 409);
  }
  const push = sendPushToUser(result.artistUserId, {
    title: "مشتری نوبت رو لغو کرد",
    body: `${result.booking.client_name || "مشتری"}، ${result.booking.service || "نوبت"}، ${bookingWhen(result.booking.booking_date, result.booking.time)}`
  }).catch(() => null);
  smsClientCancelled(result.artistUserId, { client: result.booking.client_name, bookingDate: result.booking.booking_date, time: result.booking.time }, push);
  return json({ data: { booking: result.booking } });
}

export const POST = withErrorHandling(_POST);
