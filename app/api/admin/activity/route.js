import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import { getActivityReport } from "../../../lib/db/repos/activity.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?days=7|30|90: visits, where people come from, where they leave and where each role stops. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  return json({ data: await getActivityReport(new URL(request.url).searchParams.get("days") || 30) });
}

export const GET = withErrorHandling(_GET);
