import { json, readObjectBody, withErrorHandling } from "../../lib/http.js";
import { requireTeamPair } from "../../lib/teamPair.js";
import { answerProposal, checkTerms, propose, termsOverview } from "../../lib/db/repos/teamAgreements.js";
import { TEAM_URL, notifyConnection } from "../../lib/connectionNotify.js";
import { checkRateLimit } from "../../lib/rateLimit.js";

export const runtime = "nodejs";

const REFUSALS = {
  NOT_FOUND: [404, "این پیشنهاد رو پیدا نکردیم."],
  CLOSED: [409, "این پیشنهاد همین الان جواب گرفت؛ صفحه رو تازه کردیم."],
  FORBIDDEN: [403, "این پیشنهاد رو خودت فرستادی؛ جوابش با طرف مقابله."]
};

const otherSide = (pair) => (pair.side === "salon" ? pair.artistUserId : pair.salonUserId);

/** GET /api/team-terms?salonUserId=… (artist) | artistUserId=… (salon) → { current, upcoming, pending } the terms of one team pair. */
async function _GET(request) {
  const pair = await requireTeamPair(request, Object.fromEntries(new URL(request.url).searchParams));
  if (!pair.ok) return pair.response;
  return json({ data: { side: pair.side, ...(await termsOverview(pair.salonUserId, pair.artistUserId)) } });
}

/**
 * POST /api/team-terms { salonUserId | artistUserId, days, from, to, share, ownShare?, note?, effectiveFrom? } → a proposal to
 * change the terms from either side (owner's decision 2026-10-28). It waits for the other side; until then the old terms
 * stand. A new proposal replaces the waiting one (that is how a counter-offer works).
 */
async function _POST(request) {
  const body = await readObjectBody(request);
  const pair = await requireTeamPair(request, body);
  if (!pair.ok) return pair.response;
  const limited = await checkRateLimit(`terms:${pair.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return json({ error: "یه کم زیاد پیشنهاد دادی؛ چند لحظه دیگه دوباره بزن." }, { status: 429 });
  const checked = await checkTerms(pair.salonUserId, body);
  if (!checked.ok) return json({ error: checked.error, code: "INVALID" }, { status: 400 });
  await propose({ salonUserId: pair.salonUserId, artistUserId: pair.artistUserId, by: pair.side, value: checked.value, effectiveFrom: body.effectiveFrom });
  notifyConnection(otherSide(pair), { title: `${pair.user.name || "طرف همکارت"} شرایط تازه پیشنهاد داد`, body: "ببین و جواب بده. تا جواب ندی، شرایط قبلی می‌مونه.", url: TEAM_URL });
  return json({ data: { side: pair.side, ...(await termsOverview(pair.salonUserId, pair.artistUserId)) } }, { status: 201 });
}

/** PATCH /api/team-terms { salonUserId | artistUserId, id, action: "accept" | "reject" | "cancel" } */
async function _PATCH(request) {
  const body = await readObjectBody(request);
  const pair = await requireTeamPair(request, body);
  if (!pair.ok) return pair.response;
  const action = ["accept", "reject", "cancel"].includes(body.action) ? body.action : "";
  if (!action) return json({ error: "درخواست درست نرسید؛ دوباره بزن." }, { status: 400 });
  const result = await answerProposal({ salonUserId: pair.salonUserId, artistUserId: pair.artistUserId, id: Number(body.id), side: pair.side, action });
  if (!result.ok) {
    const [status, message] = REFUSALS[result.code] || REFUSALS.NOT_FOUND;
    return json({ error: message, code: result.code }, { status });
  }
  if (action === "accept") notifyConnection(otherSide(pair), { title: "پیشنهادت قبول شد", body: `${pair.user.name || "طرف همکارت"} شرایط تازه رو قبول کرد.`, url: TEAM_URL });
  if (action === "reject") notifyConnection(otherSide(pair), { title: "پیشنهادت قبول نشد", body: `${pair.user.name || "طرف همکارت"} شرایط تازه رو قبول نکرد؛ شرایط قبلی می‌مونه.`, url: TEAM_URL });
  return json({ data: { side: pair.side, ...(await termsOverview(pair.salonUserId, pair.artistUserId)) } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const PATCH = withErrorHandling(_PATCH);
