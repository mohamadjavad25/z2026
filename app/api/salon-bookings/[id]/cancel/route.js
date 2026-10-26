import { error, json, notFound, parseId, requireUserRole, withErrorHandling } from "../../../../lib/http.js";
import * as salons from "../../../../lib/db/repos/salons.js";
import { noticeProviderClientCancelled } from "../../../../lib/clientCancelNotice.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";

export const runtime = "nodejs";

/** POST /api/salon-bookings/:id/cancel -- the booking's own client cancels it. */
async function _POST(request, { params }) {
  const auth = await requireUserRole(request, "client", "فقط خود مشتری می‌تونه نوبتش رو لغو کنه.");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const limited = await checkRateLimit(`booking-cancel:${auth.user.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) return error("یه کم زیاد زدی؛ چند لحظه دیگه دوباره بزن.", 429);

  const result = await salons.cancelSalonBookingByClient(id, auth.user);
  if (!result.ok) {
    if (result.error === "missing") return notFound("این نوبت رو پیدا نکردیم.");
    if (result.error === "inactive") return error("این نوبت دیگه فعال نیست.", 409);
    if (result.error === "past") return error("این نوبت گذشته و دیگه لغو نمی‌شه.", 409);
    return error("لغو نشد؛ دوباره بزن.", 409);
  }
  noticeProviderClientCancelled("salon", result);
  return json({ data: { booking: result.booking } });
}

export const POST = withErrorHandling(_POST);
