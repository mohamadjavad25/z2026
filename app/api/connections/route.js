import { ensureDb } from "../../lib/db/connection.js";
import { error, json, parseId, readJson, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as connections from "../../lib/db/repos/connections.js";

export const runtime = "nodejs";

// The client's own salons and artists ("سالن و آرتیست من").
//   GET    -> the list
//   POST   { targetUserId } -> connect (idempotent)
//   DELETE { targetUserId } -> remove from the list

async function _GET(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client", "فقط مشتری‌ها لیست سالن و آرتیست دارند.");
  if (!auth.ok) return auth.response;
  return json({ data: { connections: await connections.listConnections(auth.user.id) } });
}

async function _POST(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client", "فقط مشتری‌ها می‌توانند وصل شوند.");
  if (!auth.ok) return auth.response;
  const targetUserId = parseId((await readJson(request))?.targetUserId);
  if (!targetUserId) return error("سالن یا آرتیست مشخص نیست.");
  const result = await connections.connect(auth.user.id, targetUserId);
  if (!result.ok) return error("این سالن یا آرتیست پیدا نشد.", 404);
  return json({ data: { profile: result.profile, alreadyConnected: result.alreadyConnected } });
}

async function _DELETE(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client");
  if (!auth.ok) return auth.response;
  const targetUserId = parseId((await readJson(request))?.targetUserId);
  if (!targetUserId) return error("سالن یا آرتیست مشخص نیست.");
  return json({ data: await connections.disconnect(auth.user.id, targetUserId) });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
