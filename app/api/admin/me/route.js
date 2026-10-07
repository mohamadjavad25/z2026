import { json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { adminAuthConfigured, getAdminFromRequest, setupKeyConfigured } from "../../../lib/adminAuth.js";
import { countActive } from "../../../lib/db/repos/support.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the /admin page decide between the login form and the panel. Safe for anyone: reveals only whether *this browser* holds a live admin session. */
async function _GET(request) {
  await ensureDb();
  const admin = await getAdminFromRequest(request);
  // Only a signed-in admin gets the count (it feeds the badge on the Support tab); everyone else sees nothing about the inbox.
  const openTickets = admin ? await countActive().catch(() => 0) : 0;
  return json({ data: { isAdmin: Boolean(admin), name: admin?.name || "", configured: adminAuthConfigured(), setupKeyConfigured: setupKeyConfigured(), openTickets } });
}

export const GET = withErrorHandling(_GET);
