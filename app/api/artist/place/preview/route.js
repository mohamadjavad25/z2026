import { json, requireUserRole, withErrorHandling } from "../../../../lib/http.js";
import { previewArtistWorkplace } from "../../../../lib/db/repos/artistPlace.js";

export const runtime = "nodejs";

/**
 * GET /api/artist/place/preview?salonId=12&startsOn=1405-08-04 (no salonId = the artist's own place) -- before a switch,
 * which of the artist's bookings it would move. → { data: { moving: [...], staying: [...] } }, each { id,
 * clientFirstName, service, date, time }; `staying` = the salon is closed at that hour.
 */
async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  const result = await previewArtistWorkplace(auth.user.id, {
    salonUserId: params.get("salonId") || null,
    startsOn: params.get("startsOn") || ""
  });
  if (!result.ok) return json({ error: result.error, code: result.code }, { status: result.status });
  return json({ data: { moving: result.moving, staying: result.staying } });
}

export const GET = withErrorHandling(_GET);
