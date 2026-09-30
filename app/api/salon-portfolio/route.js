import { error, json, notFound, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";
import { isImageDataUrlTooLarge } from "../../lib/mediaLimits.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ portfolio: await salons.listSalonPortfolio(auth.user.id) });
}

async function _POST(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (isImageDataUrlTooLarge(body.tile) || isImageDataUrlTooLarge(body.image)) {
    return error("حجم عکس بیش از حد مجاز (۵ مگابایت) است.", 413);
  }
  const item = await salons.addSalonPortfolio(auth.user.id, body);
  return json({ item }, { status: 201 });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (isImageDataUrlTooLarge(body.tile) || isImageDataUrlTooLarge(body.image)) {
    return error("حجم عکس بیش از حد مجاز (۵ مگابایت) است.", 413);
  }
  const item = await salons.updateSalonPortfolio(Number(body.id), auth.user.id, body);
  if (!item) return notFound();
  return json({ item });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const ok = await salons.deleteSalonPortfolio(Number(body.id), auth.user.id);
  if (!ok) return notFound();
  return json({ ok: true });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
