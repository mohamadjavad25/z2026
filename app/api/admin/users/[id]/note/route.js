import { error, json, parseId, readJson, withErrorHandling } from "../../../../../lib/http.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { requireAdmin } from "../../../../../lib/admin.js";
import * as ops from "../../../../../lib/db/repos/adminOps.js";
import * as users from "../../../../../lib/db/repos/users.js";

export const runtime = "nodejs";

/** POST { note }: a private note about this account (only admins ever see it). */
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  if (!id || !(await users.getUserById(id))) return error("کاربر پیدا نشد.", 404);
  const note = String(((await readJson(request)) || {}).note ?? "");
  if (note.length > 2000) return error("یادداشت خیلی بلند است (حداکثر ۲۰۰۰ حرف).", 400);
  await ops.saveUserNote(id, note, gate.admin.label);
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
