import { error, json, parseId, readObjectBody, requireUser, withErrorHandling } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";
import { setNoShow } from "../../lib/db/repos/noShow.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { NO_SHOW_HOURS } from "../../shared/lib/providerRules.js";
import { toPersianDigits } from "../../shared/lib/digits.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES = {
  missing: ["این نوبت رو پیدا نکردیم.", 404],
  not_confirmed: ["فقط نوبت تأییدشده رو می‌شه «نیومد» زد.", 409],
  not_started: ["هنوز ساعت این نوبت نرسیده.", 409],
  closed: [`از این نوبت بیشتر از ${toPersianDigits(NO_SHOW_HOURS)} ساعت گذشته و دیگه عوض نمی‌شه.`, 409]
};

/**
 * POST /api/booking-no-show { kind: "salon" | "artist", id, noShow: true | false }
 * «نیومد» on a confirmed booking that has started (until 24 hours after), or taking it back. A salon marks its own
 * bookings, an independent artist their direct ones; a team artist's calendar copy follows the salon's mark.
 */
async function _POST(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!["salon", "artist"].includes(auth.user.type)) return error("این کار مال سالن یا آرتیسته.", 403);
  const limited = await checkRateLimit(`booking-no-show:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) return error("یه کم زیاد زدی؛ چند لحظه دیگه دوباره بزن.", 429);
  const body = await readObjectBody(request);
  const id = parseId(body.id);
  if (!id) return error("این نوبت رو پیدا نکردیم.", 400);
  const kind = auth.user.type === "artist" ? "artist" : "salon";
  if (body.kind && body.kind !== kind) return error("این کار با حساب تو نمی‌شه.", 403);
  const result = await setNoShow({ kind, id, ownerUserId: auth.user.id, noShow: body.noShow !== false });
  if (!result.ok) {
    const [message, status] = MESSAGES[result.error] || ["نشد؛ دوباره بزن.", 409];
    return error(message, status);
  }
  return json({
    data: {
      changed: result.changed,
      bookings: kind === "salon" ? await salons.listSalonBookings(auth.user.id) : await artists.listArtistBookings(auth.user.id)
    }
  });
}

export const POST = withErrorHandling(_POST);
