import { json, requireUserRole } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ rules: await salons.getSalonRules(auth.user.id) });
}

export async function PUT(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  if (typeof body.rules !== "string") {
    return json({ error: "متن قوانین معتبر نیست." }, { status: 400 });
  }
  return json({ rules: await salons.updateSalonRules(auth.user.id, body.rules) });
}
