import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import { getDashboard } from "../../../lib/db/repos/adminDashboard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?days=7|30: the whole home page (numbers vs previous period, daily series, alerts, recent activity, 7-day forecast). */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const days = new URL(request.url).searchParams.get("days");
  return json({ data: await getDashboard(days) });
}

export const GET = withErrorHandling(_GET);
