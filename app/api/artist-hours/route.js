import { json, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as artists from "../../lib/db/repos/artists.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  return json({ hours: await artists.listArtistHours(auth.user.id) });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const hour = await artists.updateArtistHour(auth.user.id, body.day, body);
  return json({
    hour,
    hours: await artists.listArtistHours(auth.user.id)
  });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
