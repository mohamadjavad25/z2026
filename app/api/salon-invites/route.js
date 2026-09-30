import { json, notFound, requireUserRole, withErrorHandling } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  return json({
    invites: await salons.listSalonArtistInvites(auth.user.id, { status })
  });
}

async function _POST(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const result = await salons.createSalonArtistInvite(auth.user.id, body);
  if (!result.ok) {
    return json({ error: result.error, code: result.code, invite: result.invite || null }, { status: 400 });
  }
  return json({
    invite: result.invite,
    created: result.created,
    invites: await salons.listSalonArtistInvites(auth.user.id)
  }, { status: 201 });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const invite = await salons.cancelSalonArtistInvite(Number(body.id), auth.user.id);
  if (!invite) return notFound();
  return json({
    invite,
    invites: await salons.listSalonArtistInvites(auth.user.id)
  });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
