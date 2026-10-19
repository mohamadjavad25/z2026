import { ensureDb } from "../../../../lib/db/connection.js";
import * as adminPush from "../../../../lib/db/repos/adminPush.js";
import { requireAdmin } from "../../../../lib/admin.js";
import { error, json, readJson, withErrorHandling } from "../../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { token }: the «فرفرو مدیر» app's push token, sent after every admin login (app/shared/lib/nativePush.js).
 *  It needs a live admin session (not just a user login), and stays after that session ends. */
async function _POST(request) {
  await ensureDb();
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.admin.id) return error("دسترسی ندارید.", 403);
  const body = (await readJson(request)) || {};
  const result = await adminPush.saveToken(auth.admin.id, body.token);
  if (!result.ok) return error(result.error, 400);
  return json({ data: { ok: true } });
}

/** DELETE { token }: notifications turned off in the phone's settings. */
async function _DELETE(request) {
  await ensureDb();
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.admin.id) return error("دسترسی ندارید.", 403);
  const body = (await readJson(request)) || {};
  await adminPush.removeToken(auth.admin.id, body.token);
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
