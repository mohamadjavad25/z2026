import { error, json, parseId, readJson, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { isAdminPhone, requireAdmin, requireStepUp } from "../../../../lib/admin.js";
import * as admin from "../../../../lib/db/repos/admin.js";
import * as ops from "../../../../lib/db/repos/adminOps.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  const detail = id ? await ops.getUserDetail(id) : null;
  if (!detail) return error("کاربر پیدا نشد.", 404);
  return json({ data: { ...detail, isAdmin: isAdminPhone(detail.user.phone) } });
}

/** DELETE { confirmPhone }: permanently removes the account and everything that cascades from it. Needs a fresh password check and the phone typed back. */
async function _DELETE(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const id = parseId((await params).id);
  const detail = id ? await ops.getUserDetail(id) : null;
  if (!detail) return error("کاربر پیدا نشد.", 404);
  if (isAdminPhone(detail.user.phone)) return error("حساب مدیر را نمی‌شود حذف کرد.", 400);
  const body = (await readJson(request)) || {};
  if (String(body.confirmPhone || "").trim() !== detail.user.phone) return error("برای حذف، شمارهٔ کاربر را دقیقاً وارد کن.", 400);
  const removed = await ops.deleteUser(id);
  await admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action: "delete_user", detail: `${removed.phone} ${removed.name}` });
  return json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const DELETE = withErrorHandling(_DELETE);
