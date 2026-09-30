import { json, notFound, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  return json({
    data: {
      invites: await salons.listArtistSalonInvites(auth.user.id, { status }),
      pendingCount: await salons.countPendingArtistInvites(auth.user.id)
    }
  });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const result = await salons.respondArtistSalonInvite(Number(body.id), auth.user.id, body.status);
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
      pendingCount: await salons.countPendingArtistInvites(auth.user.id)
    }
  });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
