import { after } from "next/server";
import { error, json, notFound, parseId, readJson, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";
import { limitPostWrites, validatePostBody } from "../../lib/postGuard.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ data: { portfolio: await salons.listSalonPortfolio(auth.user.id) } });
}

async function _POST(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const limited = await limitPostWrites(auth.user.id);
  if (limited) return limited;
  const body = await readJson(request);
  if (!body) return error("درخواست نامعتبر است.", 400);
  const invalid = validatePostBody(body, { creating: true });
  if (invalid) return invalid;
  const item = await salons.addSalonPortfolio(auth.user.id, body, { defer: (fn) => after(fn) });
  return json({ data: { item } }, { status: 201 });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const limited = await limitPostWrites(auth.user.id);
  if (limited) return limited;
  const body = await readJson(request);
  const id = parseId(body?.id);
  if (!body || !id) return error("درخواست نامعتبر است.", 400);
  const invalid = validatePostBody(body, { creating: false });
  if (invalid) return invalid;
  const item = await salons.updateSalonPortfolio(id, auth.user.id, body, { defer: (fn) => after(fn) });
  if (!item) return notFound();
  return json({ data: { item } });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const limited = await limitPostWrites(auth.user.id);
  if (limited) return limited;
  const body = await readJson(request);
  const id = parseId(body?.id);
  if (!id) return error("درخواست نامعتبر است.", 400);
  const ok = await salons.deleteSalonPortfolio(id, auth.user.id);
  if (!ok) return notFound();
  return json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
