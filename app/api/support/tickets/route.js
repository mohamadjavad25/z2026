import { json, requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as support from "../../../lib/db/repos/support.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: the signed-in user's own tickets (messages they sent and reports they filed), most recent activity first. */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return json({ data: { tickets: await support.listUserTickets(auth.user.id) } });
}

export const GET = withErrorHandling(_GET);
