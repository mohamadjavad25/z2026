import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as control from "../../../lib/db/repos/adminControl.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?days=7|30|90: top providers and services, booking hours, the client funnel, areas and which salons/artists are not ready. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  return json({ data: await control.getReports(new URL(request.url).searchParams.get("days") || 30) });
}

export const GET = withErrorHandling(_GET);
