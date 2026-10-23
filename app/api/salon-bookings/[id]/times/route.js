import { json, notFound, parseId, requireUserRole, withErrorHandling } from "../../../../lib/http.js";
import * as salons from "../../../../lib/db/repos/salons.js";
import { bookingMoveOptions } from "../../../../lib/salonMoveTimes.js";
import { strictDayKey } from "../../../../lib/validation/bookingSlot.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/salon-bookings/:id/times[?day=] → { times: [{ time, end, overtimeMinutes }], close, closed }
 * The salon's «تغییر ساعت» list for one of its bookings (on its own day unless `day` is given):
 * only times its services fit with their artists, the ones past closing marked. PATCH accepts
 * exactly these (bookingMoveOptions).
 */
async function _GET(request, { params }) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const booking = await salons.getSalonBookingRow(id, auth.user.id);
  if (!booking) return notFound("این نوبت رو پیدا نکردیم.");
  const day = new URL(request.url).searchParams.get("day");
  const dateKey = strictDayKey(day || booking.booking_date);
  if (!dateKey) return json({ error: "این روز رو نفهمیدیم؛ دوباره انتخاب کن." }, { status: 400 });
  const result = await bookingMoveOptions(auth.user.id, id, dateKey);
  if (!result.ok) return notFound("این نوبت رو پیدا نکردیم.");
  return json({ data: { day: dateKey, times: result.times, close: result.close, closed: result.closed } });
}

export const GET = withErrorHandling(_GET);
