import { json, requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import { billingOverview } from "../../lib/billing/service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in salon's or artist's subscription: state, plans with dates, a payment being checked. Clients get { visible: false }. */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return json({ data: await billingOverview(auth.user) });
}

export const GET = withErrorHandling(_GET);
