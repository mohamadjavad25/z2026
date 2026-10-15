import { error, json, parseId, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as admin from "../../../lib/db/repos/admin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?group=&admin=&q=&user=&offset=&limit=: the audit log. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const params = new URL(request.url).searchParams;
  return json({
    data: await admin.listActions({
      group: params.get("group") || "",
      admin: params.get("admin") || "",
      q: params.get("q") || "",
      targetUserId: parseId(params.get("user")),
      limit: params.get("limit") || 50,
      offset: params.get("offset") || 0
    })
  });
}

export const GET = withErrorHandling(_GET);
