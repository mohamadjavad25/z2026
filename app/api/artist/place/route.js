import { json, requireUserRole, withErrorHandling, readObjectBody } from "../../../lib/http.js";
import { getArtistTeamPlace, saveArtistPlace } from "../../../lib/db/repos/artistPlace.js";
import * as salons from "../../../lib/db/repos/salons.js";
import * as users from "../../../lib/db/repos/users.js";
import { findSalonHourForWeekday, isSalonHourOpen } from "../../../shared/lib/salonAvailability.js";
import { PLACE_WEEKDAYS } from "../../../shared/lib/artistPlace.js";

export const runtime = "nodejs";

async function view(artistUserId) {
  const team = await getArtistTeamPlace(artistUserId);
  if (!team) return null;
  const [salonHours, artist] = await Promise.all([salons.listSalonHours(team.salonUserId), users.getUserProfileById(artistUserId)]);
  return {
    salonId: team.salonUserId,
    salonName: team.salonName,
    salonArea: team.salonArea,
    allowed: team.allowed,
    mode: team.mode,
    days: team.days,
    // Which weekdays the salon is open (the artist sees «سالن بسته‌ست» on the others), and whether the artist has an address
    // of their own to show when they choose «جای خودم».
    salonOpenDays: PLACE_WEEKDAYS.map((day) => isSalonHourOpen(findSalonHourForWeekday(salonHours, day))),
    hasOwnAddress: Boolean(String(artist?.area || "").trim() || artist?.geo_lat != null)
  };
}

/** GET /api/artist/place → { place } where the artist's own clients are received (null for an artist on no salon team). */
async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: { place: await view(auth.user.id) } });
}

/** PUT /api/artist/place { mode: 'own'|'salon'|'days', days?: 'sosooso' } → { place } */
async function _PUT(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const result = await saveArtistPlace(auth.user.id, { salonUserId: body.salonUserId, mode: body.mode, days: body.days });
  if (!result.ok) return json({ error: result.error, code: result.code }, { status: result.status });
  return json({ data: { place: await view(auth.user.id) } });
}

export const GET = withErrorHandling(_GET);
export const PUT = withErrorHandling(_PUT);
