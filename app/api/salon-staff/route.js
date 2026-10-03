import { json, notFound, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";

export const runtime = "nodejs";

// There is deliberately no POST here: staff are never created by hand. A person joins
// the team only through a real artist account (an accepted invite / collaboration, or
// the salon QR join), so every member is a consenting, verifiable artist.

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ data: { staff: await salons.listSalonStaff(auth.user.id) } });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const person = await salons.updateSalonStaff(Number(body.id), auth.user.id, body);
  if (!person) return notFound();
  return json({ data: { person, staff: await salons.listSalonStaff(auth.user.id) } });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const result = await salons.deleteSalonStaff(Number(body.id), auth.user.id);
  if (!result?.ok) return notFound();
  const artistUserId = Number(result.person?.artist_user_id || 0) || null;
  const endedCollabs = artistUserId
    ? await artists.endSalonCollabsForArtist(auth.user.id, artistUserId)
    : 0;
  return json({
    data: {
      ok: true,
      staff: await salons.listSalonStaff(auth.user.id),
      endedCollabs,
      artistNotified: endedCollabs > 0,
      artistUserId
    }
  });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
