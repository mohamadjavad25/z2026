import { json, notFound, requireUserRole } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  return json({
    data: {
      invites: salons.listArtistSalonInvites(auth.user.id, { status }),
      pendingCount: salons.countPendingArtistInvites(auth.user.id)
    }
  });
}

export async function PATCH(request) {
  const auth = requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const result = salons.respondArtistSalonInvite(Number(body.id), auth.user.id, body.status);
  if (!result.ok) {
    const statusCode = result.code === "NOT_FOUND" ? 404 : 400;
    if (result.code === "NOT_FOUND") return notFound();
    return json({ error: result.error, code: result.code, invite: result.invite || null }, { status: statusCode });
  }
  return json({
    data: {
      invite: result.invite,
      staffPerson: result.staffPerson,
      staffCreated: result.staffCreated,
      invites: result.invites,
      pendingCount: salons.countPendingArtistInvites(auth.user.id)
    }
  });
}
