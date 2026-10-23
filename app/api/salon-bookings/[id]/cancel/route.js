import { error, json, notFound, parseId, requireUserRole, withErrorHandling } from "../../../../lib/http.js";
import * as salons from "../../../../lib/db/repos/salons.js";
import { sendPushToUser } from "../../../../lib/push.js";
import { bookingWhen, smsClientCancelled } from "../../../../lib/bookingSms.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";
import { notifyStaff } from "../../../../lib/staffNotify.js";

export const runtime = "nodejs";

/** POST /api/salon-bookings/:id/cancel -- the booking's own client cancels it. */
async function _POST(request, { params }) {
  const auth = await requireUserRole(request, "client", "فقط مشتری می‌تواند رزرو خودش را لغو کند.");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const limited = await checkRateLimit(`booking-cancel:${auth.user.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) return error("تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره امتحان کن.", 429);

  const result = await salons.cancelSalonBookingByClient(id, auth.user);
  if (!result.ok) {
    if (result.error === "missing") return notFound("رزرو یافت نشد.");
    if (result.error === "inactive") return error("این رزرو دیگر فعال نیست.", 409);
    if (result.error === "past") return error("رزرو گذشته قابل لغو نیست.", 409);
    return error("لغو رزرو انجام نشد.", 409);
  }
  const push = sendPushToUser(result.salonUserId, {
    title: "مشتری نوبت را لغو کرد",
    body: `${result.booking.client || "مشتری"} — ${result.booking.service || "نوبت"} · ${bookingWhen(result.booking.booking_date, result.booking.time)}`
  }).catch(() => null);
  smsClientCancelled(result.salonUserId, { client: result.booking.client, bookingDate: result.booking.booking_date, time: result.booking.time }, push);
  notifyStaff({ salonBookingId: result.booking.id }, {
    title: "مشتری نوبت را لغو کرد",
    body: `${result.booking.client || "مشتری"} — ${result.booking.service || "نوبت"} · ${bookingWhen(result.booking.booking_date, result.booking.time)}`
  });
  return json({ data: { booking: result.booking } });
}

export const POST = withErrorHandling(_POST);
