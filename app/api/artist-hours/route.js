import { json, requireUserRole } from "../../lib/http.js";
import * as artists from "../../lib/db/repos/artists.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  return json({ hours: artists.listArtistHours(auth.user.id) });
}

export async function PATCH(request) {
  const auth = requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const hour = artists.updateArtistHour(auth.user.id, body.day, body);
  return json({
    hour,
    hours: artists.listArtistHours(auth.user.id)
  });
}
