import { json, requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as support from "../../../lib/db/repos/support.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: how many of my tickets have a reply I have not opened yet (the dot on the floating support button). Signed-out visitors just get 0. */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return json({ data: { unread: 0 } });
  return json({ data: { unread: await support.countUserUnread(auth.user.id) } });
}

export const GET = withErrorHandling(_GET);
