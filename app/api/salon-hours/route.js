import { error, json, readJson, requireUserRole, withErrorHandling } from "../../lib/http.js";
import { readHoursPatch, readHoursWeek } from "../../lib/validation/hours.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: { hours: await salons.listSalonHours(auth.user.id) } });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const rows = await salons.listSalonHours(auth.user.id);
  // The hours sheet saves the whole week at once ({ hours: [...] }); one day ({ day, ... }) still works for older apps.
  if (Array.isArray(body?.hours)) {
    const week = readHoursWeek(body, rows);
    if (!week.ok) return error(week.error, 400);
    return json({ data: { hours: await salons.saveSalonHoursWeek(auth.user.id, week.days) } });
  }
  const read = readHoursPatch(body, rows);
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
