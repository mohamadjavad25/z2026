import { json, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import { getPublicNotice } from "../../lib/db/repos/adminControl.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The site-wide notice the operator turned on in the admin panel (or null). Public: it is shown to everyone it targets. */
async function _GET() {
  await ensureDb();
  const notice = await getPublicNotice().catch(() => null);
  return json({ data: { notice } }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } });
}

export const GET = withErrorHandling(_GET);
