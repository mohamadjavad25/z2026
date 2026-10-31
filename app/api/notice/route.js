import { json, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import { getPublicAndroidApp, getPublicNotice } from "../../lib/db/repos/adminControl.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The site-wide notice the operator turned on in the admin panel (or null), and the newest Android build on Cafe Bazaar
 * (features/appUpdate). Public: it is shown to everyone it targets.
 */
async function _GET() {
  await ensureDb();
  const [notice, app] = await Promise.all([
    getPublicNotice().catch(() => null),
    getPublicAndroidApp().catch(() => null)
  ]);
  // Not cached: switching the notice off must take effect at once, and a stale-while-revalidate copy kept a background
  // request open in the browser. One small query per app start.
  return json({ data: { notice, app } });
}

export const GET = withErrorHandling(_GET);
