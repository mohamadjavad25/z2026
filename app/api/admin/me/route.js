import { json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { adminAuthConfigured, getAdminFromRequest, setupKeyConfigured } from "../../../lib/adminAuth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the /admin page decide between the login form and the panel. Safe for anyone: reveals only whether *this browser* holds a live admin session. */
async function _GET(request) {
  await ensureDb();
  const admin = await getAdminFromRequest(request);
  return json({ data: { isAdmin: Boolean(admin), name: admin?.name || "", configured: adminAuthConfigured(), setupKeyConfigured: setupKeyConfigured() } });
}

export const GET = withErrorHandling(_GET);
