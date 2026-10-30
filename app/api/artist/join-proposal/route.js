import { ensureDb } from "../../../lib/db/connection.js";
import { json, notFound, readObjectBody, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import { createJoinProposal } from "../../../lib/db/repos/artists.js";
import { TEAM_URL, notifyConnection } from "../../../lib/connectionNotify.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";

export const runtime = "nodejs";

const STATUS = {
  SALON_NOT_FOUND: 404,
  INVALID_SALON: 400,
  INVALID: 400,
  NOTE_TOO_LONG: 400,
  INVALID_CODE: 400,
  ARTIST_NOT_FOUND: 400,
  ALREADY_STAFF: 409,
  TERMS_NOT_READY: 409,
  TERMS_CHANGED: 409,
  PROPOSALS_OFF: 409,
  PENDING_EXISTS: 409,
  INVITE_PENDING: 409
};

/**
 * POST /api/artist/join-proposal (artist) { salonUserId, code, termsVersion, days, from, to, share, ownShare?, note? } →
 * 201 { data: { collab } } (status «آماده ارسال», `expiresAt` in 7 days). The salon answers it in /api/salon-collabs.
 * Refusals { error, code }: TERMS_CHANGED (409, also carries `terms`), TERMS_NOT_READY, PROPOSALS_OFF, PENDING_EXISTS,
 * ALREADY_STAFF (409), INVALID (400, days/hours outside the salon's open hours), INVALID_CODE, NOTE_TOO_LONG (400).
 */
async function _POST(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const limited = await checkRateLimit(`join-proposal:${auth.user.id}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return json({ error: "یه کم زیاد پیشنهاد دادی؛ چند لحظه دیگه دوباره بزن." }, { status: 429 });
  const days = Array.isArray(body.days) ? body.days.join("،") : body.days;
  const result = await createJoinProposal(auth.user.id, { ...body, days, code: String(body.code || "").trim() });
  if (!result.ok) {
    if (result.code === "SALON_NOT_FOUND") return notFound(result.error);
    return json({ error: result.error, code: result.code, ...(result.terms ? { terms: result.terms } : {}) }, { status: STATUS[result.code] || 400 });
  }
  notifyConnection(Number(body.salonUserId), {
    title: `${auth.user.name || "یه آرتیست"} شرایط خودش رو پیشنهاد داد`,
    body: "ببین و جواب بده؛ تا ۷ روز وقت داری.",
    url: TEAM_URL
  });
  return json({ data: { collab: result.collab } }, { status: 201 });
}

export const POST = withErrorHandling(_POST);
