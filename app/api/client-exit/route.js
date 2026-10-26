import { error, json, requireUser, withErrorHandling } from "../../lib/http.js";
import { describeClientPlan, planClientExit } from "../../lib/db/repos/clientExit.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/client-exit — what stands in the way of a client deleting their account: confirmed bookings within 24 hours
 * (`near`, they block it) and every other open booking or request (`rest`, cancelled together with the deletion). Each
 * carries the salon's or artist's name and number, for «تماس».
 */
async function _GET(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.type !== "client") return error("این فقط برای حساب مشتریه.", 400);
  return json({ data: { plan: describeClientPlan(await planClientExit(auth.user)) } });
}

export const GET = withErrorHandling(_GET);
