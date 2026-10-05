import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as admin from "../../../lib/db/repos/admin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  return json({ data: { actions: await admin.listActions(50) } });
}

export const GET = withErrorHandling(_GET);
