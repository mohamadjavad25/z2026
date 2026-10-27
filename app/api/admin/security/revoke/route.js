import { error, json, parseId, readJson, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { requireAdmin, requireStepUp } from "../../../../lib/admin.js";
import { getAdminAccount, revokeAdminSessions } from "../../../../lib/adminAuth.js";
import * as admin from "../../../../lib/db/repos/admin.js";

export const runtime = "nodejs";

/** POST { adminId }: ends every live admin session of that admin (including your own). Needs a fresh password check. */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const adminId = parseId(((await readJson(request)) || {}).adminId);
  if (!adminId) return error("درخواست نامعتبر است.", 400);
  const target = await getAdminAccount(adminId);
  await revokeAdminSessions(adminId);
  await admin.logAction({ adminLabel: gate.admin.label, action: "revoke_sessions", detail: target?.phone || "" });
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
