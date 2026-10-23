import { error, json, parseId, readObjectBody, requireUserRole, withErrorHandling } from "../../../lib/http.js";
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
  const auth = await requireUserRole(request, "client", "فقط مشتری می‌تواند به پیشنهاد جواب بدهد.");
  if (!auth.ok) return auth.response;
  const limited = await checkRateLimit(`booking-answer:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return error("تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره امتحان کن.", 429);
  const body = await readObjectBody(request);
  const id = parseId(body.id);
  const kind = body.kind === "artist" ? "artist" : "salon";
  if (!id) return error("شناسه رزرو نامعتبر است.", 400);
  if (!["accept", "cancel"].includes(body.action)) return error("جواب مشخص نیست.", 400);

  if (body.action === "cancel") {
    const claimed = await proposals.claimProposalForCancel({ kind, id, client: auth.user });
    if (!claimed) return json({ error: "پیشنهادی برای این نوبت نمانده است؛ صفحه را تازه کن.", code: "NO_PROPOSAL" }, { status: 409 });
    const result = kind === "artist" ? await artists.cancelArtistBookingByClient(id, auth.user) : await salons.cancelSalonBookingByClient(id, auth.user);
    if (!result.ok) {
      if (result.error === "missing") return error("رزرو یافت نشد.", 404);
      if (result.error === "past") return error("رزرو گذشته قابل لغو نیست.", 409);
      return error("این رزرو دیگر فعال نیست.", 409);
    }
    const providerId = Number(kind === "artist" ? result.artistUserId : result.salonUserId || 0);
    noticeProviderProposalAnswer(providerId, { accepted: false, booking: result.booking, clientName: result.booking.client || result.booking.client_name || auth.user.name });
    return json({ data: { booking: result.booking, cancelled: true } });
  }

  const result = await proposals.acceptProposal({ kind, id, client: auth.user });
  if (!result.ok) {
    if (result.error === "unavailable" && result.before) {
      const providerId = Number(kind === "artist" ? result.artistUserId : result.salonUserId || 0);
      void sendPushToUser(providerId, {
        title: "پیشنهادت ثبت نشد",
        body: `${result.before.client || result.before.client_name || "مشتری"} — ${result.before.service || "نوبت"}: ساعت یا آرتیست پیشنهادی دیگر آزاد نبود؛ نوبت قبلی سر جایش است. با مشتری تماس بگیر.`
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
