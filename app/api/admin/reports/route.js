import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as control from "../../../lib/db/repos/adminControl.js";
import { landingVisitDays } from "../../../lib/db/repos/landingVisits.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?days=7|30|90: top providers and services, booking hours, the client funnel, areas, which salons/artists are not ready, and what the link pages brought. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const reports = await control.getReports(new URL(request.url).searchParams.get("days") || 30);
  // The link pages (/go for the reel, /s for the advertising SMS): visits per day beside that day's new salons and artists.
  return json({ data: { ...reports, links: await landingVisitDays(reports.days) } });
}

export const GET = withErrorHandling(_GET);
