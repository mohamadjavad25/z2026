import { ensureDb } from "../../../lib/db/connection.js";
import * as nativePush from "../../../lib/db/repos/nativePush.js";
import { error, json, readJson, requireUser, withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

/** POST { token, platform }: the frfro Android app's push token, sent every time the app opens with
 *  notifications allowed (app/shared/lib/nativePush.js). Refreshing it keeps the user off the SMS. */
async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = (await readJson(request)) || {};
  const result = await nativePush.saveToken(auth.user.id, body.token, body.platform);
  if (!result.ok) return error(result.error, 400);
  return json({ data: { ok: true } });
}

/** DELETE { token }: logout, or notifications turned off in the phone's settings. */
async function _DELETE(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = (await readJson(request)) || {};
  await nativePush.removeToken(auth.user.id, body.token);
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
