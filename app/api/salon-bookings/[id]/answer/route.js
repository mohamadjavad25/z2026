import { error, json, notFound, parseId, readJson, requireUserRole, withErrorHandling } from "../../../../lib/http.js";
import * as salons from "../../../../lib/db/repos/salons.js";
import { sendPushToUser } from "../../../../lib/push.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";

export const runtime = "nodejs";

/**
 * POST /api/salon-bookings/:id/answer { accept } -- the booking's own client answers the new
 * time the salon offered: accept confirms it, decline cancels the booking.
 */
async function _POST(request, { params }) {
  const auth = await requireUserRole(request, "client", "فقط مشتری می‌تواند به ساعت تازه جواب بدهد.");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const limited = await checkRateLimit(`booking-answer:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return error("تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره امتحان کن.", 429);
  const body = await readJson(request);
  if (typeof body?.accept !== "boolean") return error("جواب مشخص نیست.");

  const result = await salons.answerSalonTimeOffer(id, auth.user.id, body.accept);
  if (!result.ok) {
    if (result.error === "missing") return notFound("رزرو یافت نشد.");
    if (result.error === "inactive") return error("این رزرو دیگر منتظر جواب تو نیست.", 409);
    if (result.error === "past") return error("روز این رزرو گذشته است.", 409);
    return error(result.message || "این ساعت دیگر آزاد نیست.", 409);
  }
  void sendPushToUser(result.salonUserId, {
    title: body.accept ? "مشتری ساعت تازه را قبول کرد" : "مشتری ساعت تازه را رد کرد",
    body: `${result.booking.client || "مشتری"} — ${result.booking.service || "نوبت"} ${result.booking.time || ""}`.trim()
  });
  return json({ data: { booking: result.booking } });
}

export const POST = withErrorHandling(_POST);
