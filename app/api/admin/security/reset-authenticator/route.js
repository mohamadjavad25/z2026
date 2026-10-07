import { error, json, parseId, readJson, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { isAdminPhone, requireAdmin, requireStepUp } from "../../../../lib/admin.js";
import { resetAdminAuthenticator } from "../../../../lib/adminAuth.js";
import * as admin from "../../../../lib/db/repos/admin.js";
import * as users from "../../../../lib/db/repos/users.js";

export const runtime = "nodejs";

/**
 * POST { userId }: lets one admin clear ANOTHER admin's authenticator (lost phone) so that admin can run the first-time setup again.
 * Needs a fresh password check; never works on yourself; the target's live admin sessions end at once. The setup itself
 * still needs that admin's password and the setup key, so this alone grants nobody access.
 */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const userId = parseId(((await readJson(request)) || {}).userId);
  if (!userId) return error("درخواست نامعتبر است.", 400);
  if (userId === gate.admin.id) return error("Authenticator خودت را از اینجا نمی‌شود ریست کرد.", 400);
  const target = await users.getUserById(userId);
  if (!target) return error("کاربر پیدا نشد.", 404);
  if (!isAdminPhone(target.phone)) return error("این حساب مدیر نیست.", 400);
  await resetAdminAuthenticator(userId);
  await admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action: "reset_authenticator", targetUserId: userId });
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
