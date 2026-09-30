import { json, notFound, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ services: await salons.listSalonServices(auth.user.id) });
}

async function _POST(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const service = await salons.addSalonService(auth.user.id, body);
  return json({ service }, { status: 201 });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const service = await salons.updateSalonService(Number(body.id), auth.user.id, body);
  if (!service) return notFound();
  return json({ service });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const ok = await salons.deleteSalonService(Number(body.id), auth.user.id);
  if (!ok) return notFound();
  return json({ ok: true });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
