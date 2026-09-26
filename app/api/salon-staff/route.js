import { json, notFound, requireUserRole } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ staff: await salons.listSalonStaff(auth.user.id) });
}

export async function POST(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const person = await salons.addSalonStaff(auth.user.id, body);
  return json({ person, staff: await salons.listSalonStaff(auth.user.id) }, { status: 201 });
}

export async function PATCH(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const person = await salons.updateSalonStaff(Number(body.id), auth.user.id, body);
  if (!person) return notFound();
  return json({ person, staff: await salons.listSalonStaff(auth.user.id) });
}

export async function DELETE(request) {
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
    ok: true,
    staff: await salons.listSalonStaff(auth.user.id),
    endedCollabs,
    artistNotified: endedCollabs > 0,
    artistUserId
  });
}
