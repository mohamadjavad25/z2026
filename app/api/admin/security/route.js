import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import { listAdminSessions } from "../../../lib/adminAuth.js";
import * as ops from "../../../lib/db/repos/adminOps.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  return json({ data: { sessions: await listAdminSessions(), events: await ops.listSecurityEvents(60), me: gate.admin.id } });
}

export const GET = withErrorHandling(_GET);
