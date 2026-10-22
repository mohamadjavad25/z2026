import { ensureDb } from "../../../../lib/db/connection.js";
import * as adminDevice from "../../../../lib/db/repos/adminDevice.js";
import * as adminRepo from "../../../../lib/db/repos/admin.js";
import { requireAdmin } from "../../../../lib/admin.js";
import { error, json, withErrorHandling } from "../../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: a fresh read-only key for this admin's «فرفرو مدیر» app (wallpaper and "always on"), replacing any older one.
 *  Needs a live admin session; the key only ever opens GET /api/admin/device/feed. */
async function _POST(request) {
  await ensureDb();
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.admin.id) return error("دسترسی ندارید.", 403);
  const token = await adminDevice.issueToken(auth.admin.id);
  await adminRepo.logAction({ adminUserId: auth.admin.id, adminLabel: auth.admin.label, action: "device_key_issued", detail: "پس‌زمینه یا همیشه‌روشن اپ مدیر" }).catch(() => null);
  return json({ data: { token } });
}

/** DELETE: both features turned off on the phone; the key stops working. */
async function _DELETE(request) {
  await ensureDb();
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.admin.id) return error("دسترسی ندارید.", 403);
  await adminDevice.revokeForUser(auth.admin.id);
  await adminRepo.logAction({ adminUserId: auth.admin.id, adminLabel: auth.admin.label, action: "device_key_revoked" }).catch(() => null);
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
