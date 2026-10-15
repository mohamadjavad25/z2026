import { json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb, getDb, get } from "../../../lib/db/connection.js";
import { adminAuthConfigured, getAdminFromRequest, setupKeyConfigured } from "../../../lib/adminAuth.js";
import { countActive } from "../../../lib/db/repos/support.js";
import { ensureControlTables } from "../../../lib/db/repos/adminControl.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The numbers behind the badges on the rail: password resets waiting, and app crashes in the last 24 hours. */
async function badgeCounts() {
  await ensureControlTables();
  const db = await getDb();
  return get(db, `
    SELECT (SELECT COUNT(*)::int FROM password_reset_requests WHERE status = 'pending') AS resets,
           (SELECT COUNT(*)::int FROM client_errors WHERE created_at >= NOW() - INTERVAL '24 hours') AS errors
  `);
}

/** Lets the /admin page decide between the login form and the panel. Safe for anyone: reveals only whether *this browser* holds a live admin session. */
async function _GET(request) {
  await ensureDb();
  const admin = await getAdminFromRequest(request);
  // Only a signed-in admin gets the counts (they feed the badges on the rail); everyone else sees nothing about them.
  const [openTickets, counts] = admin ? await Promise.all([countActive().catch(() => 0), badgeCounts().catch(() => null)]) : [0, null];
  return json({
    data: {
      isAdmin: Boolean(admin),
      name: admin?.name || "",
      configured: adminAuthConfigured(),
      setupKeyConfigured: setupKeyConfigured(),
      openTickets,
      pendingResets: counts?.resets || 0,
      clientErrors: counts?.errors || 0
    }
  });
}

export const GET = withErrorHandling(_GET);
