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
  const params = new URL(request.url).searchParams;
  const result = await admin.listUsers({
    q: params.get("q") || "",
    type: params.get("type") || "",
    limit: params.get("limit") || 25,
    offset: params.get("offset") || 0
  });
  return json({ data: result });
}

export const GET = withErrorHandling(_GET);
