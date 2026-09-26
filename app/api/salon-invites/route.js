import { json, notFound, requireUserRole } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  return json({
    invites: await salons.listSalonArtistInvites(auth.user.id, { status })
  });
}

export async function POST(request) {
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

export async function DELETE(request) {
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
