import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import { surveyReport } from "../../../lib/db/repos/welcomeSurvey.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: what people said in the welcome survey. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  return json({ data: await surveyReport() });
}

export const GET = withErrorHandling(_GET);
