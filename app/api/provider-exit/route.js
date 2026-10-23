import { error, json, parseId, readObjectBody, requireUser, withErrorHandling } from "../../lib/http.js";
import { cancelItem, describePlan, planExit } from "../../lib/db/repos/providerExit.js";
import { checkRateLimit } from "../../lib/rateLimit.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The plan for the scope in the request, for the person asking (never anybody else's bookings). null when the role doesn't fit. */
async function planFor(user, source) {
  const scope = String(source.scope || "account");
  if (scope === "account" && ["salon", "artist"].includes(user.type)) return planExit({ scope, user });
  if (scope === "team" && user.type === "artist") {
    const salonUserId = parseId(source.salonUserId);
    return salonUserId ? planExit({ scope, user, salonUserId }) : null;
  }
  if (scope === "staff" && user.type === "salon") {
    const staffId = parseId(source.staffId);
    return staffId ? planExit({ scope, user, salonUserId: user.id, staffId }) : null;
  }
  return null;
}

/**
 * GET /api/provider-exit?scope=account | team&salonUserId=… | staff&staffId=…
 * What stands in the way of deleting the account, leaving a team or removing a team member: confirmed bookings within
 * 24 hours (`near`, they block it) and farther confirmed ones (`farConfirmed`, each to be cancelled or handed over).
 * Each booking carries the client's number (for «تماس با مشتری») and, for a team member, who could take it.
 */
async function _GET(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const plan = await planFor(auth.user, Object.fromEntries(new URL(request.url).searchParams));
  if (!plan) return error("درخواست درست نرسید؛ دوباره بزن.", 400);
  return json({ data: { plan: await describePlan(plan) } });
}

/**
 * POST /api/provider-exit { scope, …, kind, id } — «لغو با اطلاع مشتری»: cancels one booking of that plan. The client gets
 * the push, the in-app card and the SMS; for a booking that was confirmed it counts in the account's «لغو توسط سالن» counter.
 */
async function _POST(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const limited = await checkRateLimit(`provider-exit-cancel:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) return error("یه کم زیاد لغو کردی؛ چند لحظه دیگه دوباره بزن.", 429);
  const body = await readObjectBody(request);
  const plan = await planFor(auth.user, body);
  if (!plan) return error("درخواست درست نرسید؛ دوباره بزن.", 400);
  const id = parseId(body.id);
  const kind = body.kind === "artist" ? "artist" : "salon";
  const item = plan.items.find((entry) => entry.kind === kind && entry.id === id);
  if (!item) return error("این نوبت دیگه توی فهرست نیست.", 404);
  const result = await cancelItem(item, { by: "provider", userId: auth.user.id, actor: auth.user, purgeMirrorOf: item.team ? plan.staffRows.map((row) => row.artist_user_id).filter(Boolean) : [] });
  if (!result.ok) return error("این نوبت همین الان عوض شد؛ فهرست رو تازه کردیم.", 409);
  const fresh = await planFor(auth.user, body);
  return json({ data: { plan: await describePlan(fresh) } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
