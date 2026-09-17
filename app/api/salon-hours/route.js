import { json, requireUserRole } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ hours: salons.listSalonHours(auth.user.id) });
}

export async function PATCH(request) {
  const auth = requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const hour = salons.updateSalonHour(auth.user.id, body.day, body);
  return json({
    hour,
    hours: salons.listSalonHours(auth.user.id)
  });
}
