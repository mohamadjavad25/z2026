import { ensureDb } from "../../../lib/db/connection.js";
import * as push from "../../../lib/db/repos/push.js";
import { json, requireUser, withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

/** Saves the browser's PushSubscription for the logged-in user — called
 *  right after a successful pushManager.subscribe() on the client (see
 *  the subscribe flow in HomeApp.jsx). */
async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const subscription = body?.subscription;
  if (!subscription?.endpoint) return json({ error: "اشتراک نامعتبر است." }, { status: 400 });

  const result = await push.saveSubscription(auth.user.id, subscription);
  if (!result.ok) return json({ error: result.error || "ذخیره اشتراک انجام نشد." }, { status: 400 });
  return json({ data: { ok: true } });
}

/** Drops one subscription — called when the browser reports the
 *  subscription is no longer valid, or the user turns notifications off. */
async function _DELETE(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (!endpoint) return json({ error: "endpoint لازم است." }, { status: 400 });

  await push.removeSubscription(auth.user.id, endpoint);
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
