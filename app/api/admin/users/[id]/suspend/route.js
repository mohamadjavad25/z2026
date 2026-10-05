import { error, json, withErrorHandling } from "../../../../../lib/http.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { isAdminPhone, requireAdmin } from "../../../../../lib/admin.js";
import * as admin from "../../../../../lib/db/repos/admin.js";
import * as users from "../../../../../lib/db/repos/users.js";

export const runtime = "nodejs";

/** POST { suspended: boolean }. A suspended account can't log in and its sessions are deleted at once. */
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const suspended = body.suspended !== false;
  const target = await users.getUserById(Number(id));
  if (!target) return error("کاربر پیدا نشد.", 404);
  if (isAdminPhone(target.phone)) return error("حساب مدیر را نمی‌شود مسدود کرد.", 400);
  const updated = await admin.setSuspended(target.id, suspended);
  await admin.logAction({
    adminUserId: gate.admin.id,
    adminLabel: gate.admin.label,
    action: suspended ? "suspend" : "unsuspend",
    targetUserId: target.id
  });
  return json({ data: { user: updated } });
}

export const POST = withErrorHandling(_POST);
