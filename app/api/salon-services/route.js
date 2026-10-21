import { error, json, notFound, requireUserRole, withErrorHandling, readObjectBody } from "../../lib/http.js";
import { SERVICE_LIMIT_MESSAGE, serviceFieldsProblem } from "../../lib/validation/service.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ data: { services: await salons.listSalonServices(auth.user.id) } });
}

async function _POST(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const problem = serviceFieldsProblem(body);
  if (problem) return error(problem, 400);
  const service = await salons.addSalonService(auth.user.id, body);
  if (service?.limit) return json({ error: SERVICE_LIMIT_MESSAGE, code: "SERVICE_LIMIT" }, { status: 409 });
  return json({ data: { service } }, { status: 201 });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const problem = serviceFieldsProblem(body);
  if (problem) return error(problem, 400);
  const service = await salons.updateSalonService(Number(body.id), auth.user.id, body);
  if (!service) return notFound();
  return json({ data: { service } });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const ok = await salons.deleteSalonService(Number(body.id), auth.user.id);
  if (!ok) return notFound();
  return json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
