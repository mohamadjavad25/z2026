import { error, json, parseId, readObjectBody, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import { checkWaitlistSoon } from "../../../lib/waitlist.js";
import * as salons from "../../../lib/db/repos/salons.js";
import * as artists from "../../../lib/db/repos/artists.js";
import * as proposals from "../../../lib/db/repos/bookingProposals.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { noticeProviderProposalAnswer, noticeProposalLapsed } from "../../../lib/providerNotices.js";
import { sendPushToUser } from "../../../lib/push.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = { missing: 404, inactive: 409, no_proposal: 409, expired: 409, stale: 409, unavailable: 409 };

/**
 * POST /api/booking-proposals/answer (the booking's client) { kind: "salon" | "artist", id, action: "accept" | "cancel" }
 *   accept  «قبول می‌کنم»: the booking moves to the proposed time / artist (refused, original untouched, when the
 *           proposal ran out, was replaced, or the new time is no longer free)
 *   cancel  «لغو نوبت، بدون هیچ مشکلی»: the client cancels; nothing counts against anybody
 */
async function _POST(request) {
  const auth = await requireUserRole(request, "client", "فقط خود مشتری می‌تونه به پیشنهاد جواب بده.");
  if (!auth.ok) return auth.response;
  const limited = await checkRateLimit(`booking-answer:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return error("یه کم زیاد زدی؛ چند لحظه دیگه دوباره بزن.", 429);
  const body = await readObjectBody(request);
  const id = parseId(body.id);
  const kind = body.kind === "artist" ? "artist" : "salon";
  if (!id) return error("این نوبت رو پیدا نکردیم.", 400);
  if (!["accept", "cancel"].includes(body.action)) return error("قبول یا رد؟ یکی رو بزن.", 400);

  if (body.action === "cancel") {
    const claimed = await proposals.claimProposalForCancel({ kind, id, client: auth.user });
    if (!claimed) return json({ error: "پیشنهادی برای این نوبت نمونده؛ صفحه رو تازه کن.", code: "NO_PROPOSAL" }, { status: 409 });
    const result = kind === "artist" ? await artists.cancelArtistBookingByClient(id, auth.user) : await salons.cancelSalonBookingByClient(id, auth.user);
    if (!result.ok) {
      if (result.error === "missing") return error("این نوبت رو پیدا نکردیم.", 404);
      if (result.error === "past") return error("این نوبت گذشته و دیگه لغو نمی‌شه.", 409);
      return error("این نوبت دیگه فعال نیست.", 409);
    }
    const providerId = Number(kind === "artist" ? result.artistUserId : result.salonUserId || 0);
    noticeProviderProposalAnswer(providerId, { accepted: false, booking: result.booking, clientName: result.booking.client || result.booking.client_name || auth.user.name });
    checkWaitlistSoon(kind, providerId, result.booking.booking_date);
    return json({ data: { booking: result.booking, cancelled: true } });
  }

  const result = await proposals.acceptProposal({ kind, id, client: auth.user });
  if (!result.ok) {
    if (result.error === "unavailable" && result.before) {
      const providerId = Number(kind === "artist" ? result.artistUserId : result.salonUserId || 0);
      void sendPushToUser(providerId, {
        title: "پیشنهادت نرسید",
        body: `${result.before.client || result.before.client_name || "مشتری"}، ${result.before.service || "نوبت"}: ساعت یا آرتیستی که پیشنهاد دادی دیگه آزاد نبود؛ نوبت قبلی سر جاشه. به مشتری زنگ بزن.`
      });
    }
    // The client answered after the deadline and this call is the one that closed it: the provider is told to call.
    if (result.lapsed) noticeProposalLapsed({ providerUserId: result.lapsed.providerUserId, clientUserId: null, booking: result.lapsed.booking, clientName: result.lapsed.clientName });
    return json({ error: result.message, code: result.code || result.error.toUpperCase() }, { status: STATUS[result.error] || 409 });
  }
  const providerId = Number(kind === "artist" ? result.artistUserId : result.salonUserId || 0);
  noticeProviderProposalAnswer(providerId, {
    accepted: true,
    booking: result.booking,
    clientName: result.booking.client || result.booking.client_name || auth.user.name,
    what: result.before?.proposal_staff ? "آرتیست" : "ساعت"
  });
  return json({ data: { booking: result.booking } });
}

export const POST = withErrorHandling(_POST);
