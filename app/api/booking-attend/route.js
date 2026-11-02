import { error, json, parseId, readObjectBody, requireUser, withErrorHandling } from "../../lib/http.js";
import { confirmAttendance } from "../../lib/db/repos/attendance.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { ensureBookingPartsColumns } from "../../lib/db/repos/salons/bookings.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES = {
  missing: ["این نوبت رو پیدا نکردیم.", 404],
  not_open: ["این نوبت الان جواب «میای؟» نمی‌خواد.", 409]
};

/**
 * POST /api/booking-attend { kind: "salon" | "artist", id }
 * «آره، میام» on the client's own confirmed visit within a day of its start. «نمی‌تونم» is the ordinary cancel.
 * No push goes to the salon or artist: the answer shows on the booking.
 */
async function _POST(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.type !== "client") return error("این کار مال مشتریه.", 403);
  const limited = await checkRateLimit(`booking-attend:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return error("یه کم زیاد زدی؛ چند لحظه دیگه دوباره بزن.", 429);
  const body = await readObjectBody(request);
  const id = parseId(body.id);
  if (!id) return error("این نوبت رو پیدا نکردیم.", 400);
  const kind = body.kind === "artist" ? "artist" : "salon";
  await ensureBookingPartsColumns();
  const result = await confirmAttendance({ kind, id, client: auth.user });
  if (!result.ok) {
    const [message, status] = MESSAGES[result.error] || ["نشد؛ دوباره بزن.", 409];
    return error(message, status);
  }
  return json({ data: { changed: result.changed, confirmedAt: result.booking.client_confirmed_at } });
}

export const POST = withErrorHandling(_POST);
