import { error, json, parseId, withErrorHandling } from "../../../../../lib/http.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { requireAdmin } from "../../../../../lib/admin.js";
import * as admin from "../../../../../lib/db/repos/admin.js";
import * as ops from "../../../../../lib/db/repos/adminOps.js";

export const runtime = "nodejs";

/** POST: signs the user out everywhere (deletes all their sessions). */
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  const detail = id ? await ops.getUserDetail(id) : null;
  if (!detail) return error("کاربر پیدا نشد.", 404);
  await ops.killUserSessions(id);
  await admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action: "force_logout", targetUserId: id });
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
