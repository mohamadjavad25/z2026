import { json, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ hours: await salons.listSalonHours(auth.user.id) });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const hour = await salons.updateSalonHour(auth.user.id, body.day, body);
  return json({
    hour,
    hours: await salons.listSalonHours(auth.user.id)
  });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
