import { json, requireUserRole, withErrorHandling, readObjectBody } from "../../../lib/http.js";
import { getArtistPlaces, saveArtistPlaces } from "../../../lib/db/repos/artistPlace.js";

export const runtime = "nodejs";

/** GET /api/artist/place → { place: { teams, fallback } } the artist's ordered list of salons (empty `teams`: on no team). */
async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: { place: await getArtistPlaces(auth.user.id) } });
}

/** PUT /api/artist/place { order: [salonId, …], fallback: 'own' | 'ask' } → { place } */
async function _PUT(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const result = await saveArtistPlaces(auth.user.id, { order: body.order, fallback: body.fallback });
  if (!result.ok) return json({ error: result.error, code: result.code }, { status: result.status });
  return json({ data: { place: await getArtistPlaces(auth.user.id) } });
}

export const GET = withErrorHandling(_GET);
export const PUT = withErrorHandling(_PUT);
