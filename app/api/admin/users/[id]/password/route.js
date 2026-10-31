import { error, json, parseId, readJson, withErrorHandling } from "../../../../../lib/http.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { hashPassword, normalizeDigits } from "../../../../../lib/auth.js";
import { isAdminPhone, requireAdmin, requireStepUp } from "../../../../../lib/admin.js";
import * as admin from "../../../../../lib/db/repos/admin.js";
import * as ops from "../../../../../lib/db/repos/adminOps.js";
import * as users from "../../../../../lib/db/repos/users.js";
import { deleteUserSessions } from "../../../../../lib/db/repos/sessions.js";

export const runtime = "nodejs";

/**
 * POST { newPassword }: sets a new password for someone who is locked out and ends all their sessions. Needs a fresh password check
 * (the person's own identity should have been verified first, e.g. by phone). Admin accounts are changed by their owners only.
 */
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const id = parseId((await params).id);
  const user = id ? await users.getUserById(id) : null;
  if (!user) return error("کاربر پیدا نشد.", 404);
  if (isAdminPhone(user.phone)) return error("رمز حساب مدیر را فقط خودش عوض می‌کند.", 400);
  const newPassword = normalizeDigits(String(((await readJson(request)) || {}).newPassword || ""));
  if (newPassword.length < 8) return error("رمز جدید باید حداقل ۸ کاراکتر باشد.", 400);
  await users.updateUser(id, { password_hash: await hashPassword(newPassword) });
  // A password set for the user signs them out everywhere (owner's decision of 2026-10-25).
  await deleteUserSessions(id);
  await ops.killUserSessions(id);
  await admin.logAction({ adminLabel: gate.admin.label, action: "set_password", targetUserId: id });
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
