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
  if (body.kind === "booking") {
    return patchOwnArtistBooking(auth.user.id, body);
  }
  const service = artists.updateArtistService(Number(body.id), auth.user.id, body);
  if (!service) return notFound();
  return json({ data: { service } });
}

/**
 * Real confirm/decline for a client's direct artist_bookings request
 * ("تازه" -> "تایید شده" or "لغو"), scoped to the authenticated artist —
 * mirrors PATCH /api/salon-bookings' owner-ownership-check shape (fetch the
 * row, verify it belongs to this owner, only then mutate), but stays on this
 * route rather than a new one: GET above already scopes bookings to
 * auth.user.id via artists.listArtistBookings, and POST above already
 * multiplexes booking creation behind `kind: "booking"` — this is the same
 * owner-scoped booking family, now handling the update side too. The public,
 * anonymous-allowed booking POST stays in /api/artist/bookings; that route
 * has no owner session to scope a PATCH to.
 *
 * Reuses cancelArtistBookingRow for the cancel case specifically (same
 * low-level function findLinkedSalonArtistBooking-style code already relies
 * on for a salon-linked mirror row), and updateArtistBookingRow for confirm —
 * neither has its own ownership check (by this codebase's low-level-row-
 * function convention), so the artist_user_id match below is load-bearing.
 */
function patchOwnArtistBooking(artistUserId, body) {
  const bookingId = Number(body.id);
  if (!bookingId) return error("شناسه نوبت نامعتبر است.", 400);
  const current = artists.getArtistBookingById(bookingId);
  if (!current || Number(current.artistUserId) !== Number(artistUserId)) return notFound();

  const wantsCancel = body.status === "لغو" || body.action === "cancel";
  const nextStatus = wantsCancel ? "لغو" : body.status;
  if (nextStatus !== "تایید شده" && nextStatus !== "لغو") {
    return error("وضعیت نامعتبر است.", 400);
  }

  // An already-expired request (bookingExpirySweep.js) is a dead end by
  // design: it already freed its slot, so a stale client (e.g. an unrefreshed
  // "تایید"/"رد" button) must not be able to confirm OR decline it back to
  // life. Matches the salon-side guard added in patchSalonBookingWithArtistSync's
  // caller for the same "منقضی شده" resurrection hole.
  if (current.status === "منقضی شده") {
    return error("این درخواست به‌دلیل عدم پاسخ به‌موقع منقضی شده و دیگر قابل تایید یا رد نیست.", 409);
  }

  // Confirming a STALE (but not-yet-swept) row must not silently create a
  // double booking: re-check the slot against every other active booking for
  // this artist, excluding this row itself, right before flipping it to
  // "تایید شده". This is the exact check patchSalonBookingWithArtistSync
  // already runs for its salon-linked mirror row (via isArtistSlotBlocked) —
  // the direct-artist-booking confirm path was the one place skipping it.
  if (
    nextStatus === "تایید شده"
    && artists.isArtistSlotBlocked(artistUserId, current.bookingDate, current.time, current.durationMinutes, bookingId)
  ) {
    return error("این بازه زمانی توسط نوبت دیگری اشغال شده است.", 409);
  }

  const updatedRow = wantsCancel
    ? artists.cancelArtistBookingRow(bookingId)
    : artists.updateArtistBookingRow(bookingId, { status: nextStatus });
  if (!updatedRow) return notFound();

  return json({
    data: {
      booking: artists.getArtistBookingById(bookingId),
      bookings: artists.listArtistBookings(artistUserId)
    }
  });
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
