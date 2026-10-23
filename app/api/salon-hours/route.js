import { error, json, readJson, requireUserRole, withErrorHandling } from "../../lib/http.js";
import { readHoursPatch } from "../../lib/validation/hours.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ data: { hours: await salons.listSalonHours(auth.user.id) } });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const read = readHoursPatch(await readJson(request), await salons.listSalonHours(auth.user.id));
  if (!read.ok) return error(read.error, 400);
  const hour = await salons.updateSalonHour(auth.user.id, read.day, read.patch);
  return json({
    data: {
      hour,
      hours: await salons.listSalonHours(auth.user.id)
    }
  });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
