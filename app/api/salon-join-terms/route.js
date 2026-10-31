import { ensureDb } from "../../lib/db/connection.js";
import { json, readObjectBody, requireUserRole, withErrorHandling } from "../../lib/http.js";
import { getJoinTerms, getSalonRulesText, rulesLines, saveJoinTerms } from "../../lib/db/repos/salons/joinTerms.js";
import { checkRateLimit } from "../../lib/rateLimit.js";

export const runtime = "nodejs";

async function payload(salonUserId, terms) {
  const rules = rulesLines(await getSalonRulesText(salonUserId));
  return { terms, rules: rules.lines, rulesMore: rules.more };
}

/** GET /api/salon-join-terms (salon) → { data: { terms: { days, from, to, share, ownShare, allowProposals, version } | null, rules: string[], rulesMore } }.
 *  `terms` is null until the salon saves them (then its join link is not ready). `rules` are the first 4 lines of the live rules text. */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: await payload(auth.user.id, await getJoinTerms(auth.user.id)) });
}

/** PUT /api/salon-join-terms (salon) { days: "شنبه، دوشنبه" | [..], from, to, share, ownShare?, allowProposals? } → same shape as GET.
 *  400 { error, code: "INVALID" } when the days/hours/percent do not fit the salon's open hours. */
async function _PUT(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const limited = await checkRateLimit(`join-terms:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) return json({ error: "یه کم زیاد ذخیره کردی؛ چند لحظه دیگه دوباره بزن." }, { status: 429 });
  const days = Array.isArray(body.days) ? body.days.join("،") : body.days;
  const saved = await saveJoinTerms(auth.user.id, { ...body, days });
  if (!saved.ok) return json({ error: saved.error, code: "INVALID" }, { status: 400 });
  return json({ data: await payload(auth.user.id, saved.terms) });
}

export const GET = withErrorHandling(_GET);
export const PUT = withErrorHandling(_PUT);
