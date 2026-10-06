import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as ops from "../../../lib/db/repos/adminOps.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const params = new URL(request.url).searchParams;
  return json({ data: await ops.listBookings({ q: params.get("q") || "", status: params.get("status") || "", limit: params.get("limit") || 25, offset: params.get("offset") || 0 }) });
}

export const GET = withErrorHandling(_GET);
