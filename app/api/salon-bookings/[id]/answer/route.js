import { error, json, notFound, parseId, readJson, requireUserRole, withErrorHandling } from "../../../../lib/http.js";
import * as salons from "../../../../lib/db/repos/salons.js";
import { sendPushToUser } from "../../../../lib/push.js";
import { bookingWhen } from "../../../../lib/bookingSms.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";

export const runtime = "nodejs";

/**
 * POST /api/salon-bookings/:id/answer { accept } -- the booking's own client answers the new
 * time the salon offered: accept confirms it, decline cancels the booking.
 */
async function _POST(request, { params }) {
  const auth = await requireUserRole(request, "client", "فقط خود مشتری می‌تونه به ساعت تازه جواب بده.");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const limited = await checkRateLimit(`booking-answer:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return error("یه کم زیاد زدی؛ چند لحظه دیگه دوباره بزن.", 429);
  const body = await readJson(request);
  if (typeof body?.accept !== "boolean") return error("قبول یا رد؟ یکی رو بزن.");

  const result = await salons.answerSalonTimeOffer(id, auth.user, body.accept);
  if (!result.ok) {
    if (result.error === "missing") return notFound("این نوبت رو پیدا نکردیم.");
    if (result.error === "inactive") return error("این نوبت دیگه منتظر جوابت نیست.", 409);
    if (result.error === "expired") return error("وقت جواب دادن به این ساعت تموم شده؛ هنوز می‌خوای؟ دوباره درخواست بده.", 409);
    if (result.error === "past") return error("روز این نوبت گذشته.", 409);
    return error(result.message || "این ساعت دیگه آزاد نیست.", 409);
  }
  void sendPushToUser(result.salonUserId, {
    title: body.accept ? "مشتری ساعت تازه رو قبول کرد" : "مشتری ساعت تازه رو نخواست",
    body: `${result.booking.client || "مشتری"}، ${result.booking.service || "نوبت"}، ${bookingWhen(result.booking.booking_date, result.booking.time)}`
  });
  return json({ data: { booking: result.booking } });
}

export const POST = withErrorHandling(_POST);
