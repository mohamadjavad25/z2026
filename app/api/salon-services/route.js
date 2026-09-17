import { json, notFound, requireUserRole } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ services: salons.listSalonServices(auth.user.id) });
}

export async function POST(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const service = salons.addSalonService(auth.user.id, body);
  return json({ service }, { status: 201 });
}

export async function PATCH(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const service = salons.updateSalonService(Number(body.id), auth.user.id, body);
  if (!service) return notFound();
  return json({ service });
}

export async function DELETE(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const ok = salons.deleteSalonService(Number(body.id), auth.user.id);
  if (!ok) return notFound();
  return json({ ok: true });
}
