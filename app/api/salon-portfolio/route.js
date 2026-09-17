import { json, notFound, requireUserRole } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ portfolio: salons.listSalonPortfolio(auth.user.id) });
}

export async function POST(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const item = salons.addSalonPortfolio(auth.user.id, body);
  return json({ item }, { status: 201 });
}

export async function PATCH(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const item = salons.updateSalonPortfolio(Number(body.id), auth.user.id, body);
  if (!item) return notFound();
  return json({ item });
}

export async function DELETE(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const ok = salons.deleteSalonPortfolio(Number(body.id), auth.user.id);
  if (!ok) return notFound();
  return json({ ok: true });
}
