import { error, json, notFound, requireUserRole } from "../../../lib/http.js";
import * as artists from "../../../lib/db/repos/artists.js";
import * as salons from "../../../lib/db/repos/salons.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const profile = artists.getPublicArtist(auth.user.id, auth.user.id);
  artists.syncSalonBookingsForArtist(auth.user.id);
  return json({
    data: {
      services: artists.listArtistServices(auth.user.id),
      bookings: artists.listArtistBookings(auth.user.id),
      collabs: artists.listArtistCollabs(auth.user.id),
      invites: salons.listArtistSalonInvites(auth.user.id),
      pendingInviteCount: salons.countPendingArtistInvites(auth.user.id),
      breakTime: artists.getArtistBreak(auth.user.id),
      rating: profile?.rating || "۰",
      reviewCount: profile?.reviewCount || 0,
      followers: profile?.followers || 0
    }
  });
}

export async function POST(request) {
  const auth = requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (body.kind === "booking") {
    const result = artists.addArtistBooking(auth.user.id, body);
    if (!result.ok) {
      return json({ error: result.error, code: result.code }, { status: result.code === "SLOT_TAKEN" ? 409 : 400 });
    }
    return json({
      data: {
        booking: result.booking,
        bookings: artists.listArtistBookings(auth.user.id)
      }
    }, { status: 201 });
  }
  if (body.kind === "break") {
    if (body.clear) {
      artists.clearArtistBreak(auth.user.id);
      return json({ data: { breakTime: null } });
    }
    const result = artists.setArtistBreak(auth.user.id, body.startTime, body.endTime);
    if (result && result.ok === false) {
      return error(result.error, 400);
    }
    return json({ data: { breakTime: result?.break || artists.getArtistBreak(auth.user.id) } });
  }
  if (body.kind === "collab") {
    const collab = artists.addArtistCollab(auth.user.id, body);
    return json({ data: { collab } }, { status: 201 });
  }
  const service = artists.addArtistService(auth.user.id, body);
  return json({ data: { service } }, { status: 201 });
}

export async function PATCH(request) {
  const auth = requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const service = artists.updateArtistService(Number(body.id), auth.user.id, body);
  if (!service) return notFound();
  return json({ data: { service } });
}

export async function DELETE(request) {
  const auth = requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (body.kind === "collab") {
    const ok = artists.deleteArtistCollab(Number(body.id), auth.user.id);
    if (!ok) return notFound();
    return json({ data: { ok: true } });
  }
  const ok = artists.deleteArtistService(Number(body.id), auth.user.id);
  if (!ok) return notFound();
  return json({ data: { ok: true } });
}
