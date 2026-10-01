import { json, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ data: { rules: await salons.getSalonRules(auth.user.id) } });
}

async function _PUT(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  if (typeof body.rules !== "string") {
    return json({ error: "متن قوانین معتبر نیست." }, { status: 400 });
  }
  return json({ data: { rules: await salons.updateSalonRules(auth.user.id, body.rules) } });
}

export const GET = withErrorHandling(_GET);
export const PUT = withErrorHandling(_PUT);
