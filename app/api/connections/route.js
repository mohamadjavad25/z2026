import { ensureDb } from "../../lib/db/connection.js";
import { error, json, parseId, readJson, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as connections from "../../lib/db/repos/connections.js";

export const runtime = "nodejs";

// The client's own salons and artists ("سالن و آرتیست من").
//   GET    -> the list (?services=1: each card also carries its first services, for the client's home)
//   POST   { targetUserId } -> connect (idempotent)
//   DELETE { targetUserId } -> remove from the list

async function _GET(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client", "این بخش مال مشتری‌هاست.");
  if (!auth.ok) return auth.response;
  const withServices = new URL(request.url).searchParams.get("services") === "1";
  return json({ data: { connections: await connections.listConnections(auth.user.id, { withServices }) } });
}

async function _POST(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client", "با حساب مشتری می‌شه وصل شد.");
  if (!auth.ok) return auth.response;
  const targetUserId = parseId((await readJson(request))?.targetUserId);
  if (!targetUserId) return error("کدوم سالن یا آرتیست؟ انتخابش کن.");
  const result = await connections.connect(auth.user.id, targetUserId);
  if (!result.ok) return error("این سالن یا آرتیست رو پیدا نکردیم.", 404);
  return json({ data: { profile: result.profile, alreadyConnected: result.alreadyConnected } });
}

async function _DELETE(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client");
  if (!auth.ok) return auth.response;
  const targetUserId = parseId((await readJson(request))?.targetUserId);
  if (!targetUserId) return error("کدوم سالن یا آرتیست؟ انتخابش کن.");
  return json({ data: await connections.disconnect(auth.user.id, targetUserId) });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
