import { error, json, parseId, readJson, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { isAdminPhone, requireAdmin, requireStepUp } from "../../../../lib/admin.js";
import { getAdminAccount, resetAdminAuthenticator } from "../../../../lib/adminAuth.js";
import * as admin from "../../../../lib/db/repos/admin.js";

export const runtime = "nodejs";

/**
 * POST { adminId }: lets one admin switch off ANOTHER admin's authenticator (lost phone) and end their sessions.
 * Needs a fresh password check; never works on yourself. Getting back in needs setup with the server's setup key,
 * so this alone grants nobody access.
 */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const adminId = parseId(((await readJson(request)) || {}).adminId);
  if (!adminId) return error("درخواست نامعتبر است.", 400);
  if (adminId === gate.admin.id) return error("Authenticator خودت را از اینجا نمی‌شود ریست کرد.", 400);
  const target = await getAdminAccount(adminId);
  if (!target) return error("حساب مدیر پیدا نشد.", 404);
  if (!isAdminPhone(target.phone)) return error("این شماره دیگر در فهرست مدیرها نیست.", 400);
  await resetAdminAuthenticator(adminId);
  await admin.logAction({ adminLabel: gate.admin.label, action: "reset_authenticator", detail: target.phone });
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
