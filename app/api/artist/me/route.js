import { error, json, notFound, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import { sweepExpiredBookingRequestsIfDue } from "../../../lib/bookingExpirySweep.js";
import * as artists from "../../../lib/db/repos/artists.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { countFollowers } from "../../../lib/db/repos/users.js";
import { sendPushToUser } from "../../../lib/push.js";
import { notifyConnection } from "../../../lib/connectionNotify.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { withTransaction } from "../../../lib/db/connection.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;
  await sweepExpiredBookingRequestsIfDue();
  // The sync reconciles salon bookings into the artist's list, so it must finish
  // before the bookings are read; everything else is independent.
  const [followers] = await Promise.all([
    countFollowers(userId),
    artists.syncSalonBookingsForArtist(userId)
  ]);
  const [services, bookings, collabs, invites, pendingInviteCount, breakTime] = await Promise.all([
    artists.listArtistServices(userId),
    artists.listArtistBookings(userId),
    artists.listArtistCollabs(userId),
    salons.listArtistSalonInvites(userId),
    salons.countPendingArtistInvites(userId),
    artists.getArtistBreak(userId)
  ]);
  return json({
    data: { services, bookings, collabs, invites, pendingInviteCount, breakTime, followers }
  });
}

async function _POST(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (body.kind === "booking") {
    const result = await artists.addArtistBooking(auth.user.id, body);
    if (!result.ok) {
      return json({ error: result.error, code: result.code }, { status: result.code === "SLOT_TAKEN" ? 409 : 400 });
    }
    return json({
      data: {
        booking: result.booking,
        bookings: await artists.listArtistBookings(auth.user.id)
      }
    }, { status: 201 });
  }
  if (body.kind === "break") {
    if (body.clear) {
      await artists.clearArtistBreak(auth.user.id);
      return json({ data: { breakTime: null } });
    }
    const result = await artists.setArtistBreak(auth.user.id, body.startTime, body.endTime);
    if (result && result.ok === false) {
      return error(result.error, 400);
    }
    return json({ data: { breakTime: result?.break || await artists.getArtistBreak(auth.user.id) } });
  }
  if (body.kind === "collab") {
    const limited = await checkRateLimit(`artist-collab:${auth.user.id}`, 10, 60_000);
    if (!limited.ok) return error("درخواست‌های زیاد. کمی صبر کن.", 429);
    const result = await artists.addArtistCollab(auth.user.id, body);
    if (!result.ok) {
      return json({ error: result.error, code: result.code }, { status: result.code === "SALON_NOT_FOUND" ? 404 : 400 });
    }
    notifyConnection(result.collab.salonId, {
      title: "پیشنهاد همکاری تازه",
      body: `${auth.user.name || "یک آرتیست"} می‌خواهد با سالنت همکاری کند.`,
      url: "/"
    });
    return json({ data: { collab: result.collab } }, { status: 201 });
  }
  const service = await artists.addArtistService(auth.user.id, body);
  return json({ data: { service } }, { status: 201 });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (body.kind === "booking") {
    return patchOwnArtistBooking(auth.user.id, body);
  }
  const service = await artists.updateArtistService(Number(body.id), auth.user.id, body);
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
async function patchOwnArtistBooking(artistUserId, body) {
  const bookingId = Number(body.id);
  if (!bookingId) return error("شناسه نوبت نامعتبر است.", 400);
  const current = await artists.getArtistBookingById(bookingId);
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
    && await artists.isArtistSlotBlocked(artistUserId, current.bookingDate, current.time, current.durationMinutes, bookingId)
  ) {
    return error("این بازه زمانی توسط نوبت دیگری اشغال شده است.", 409);
  }

  // A salon-assigned appointment (source_salon_user_id) is only a mirror of the salon's own
  // booking: the answer has to land on the salon booking too, in the same transaction, or the
  // salon and the client keep showing the old status.
  let updatedRow = null;
  let salonBooking = null;
  await withTransaction(null, async (db) => {
    updatedRow = wantsCancel
      ? await artists.cancelArtistBookingRow(bookingId, db)
      : await artists.updateArtistBookingRow(bookingId, { status: nextStatus }, db);
    if (updatedRow && updatedRow.source_salon_user_id) {
      salonBooking = await salons.syncSalonBookingFromArtistMirror(updatedRow, nextStatus, db);
    }
  });
  if (!updatedRow) return notFound();

  const answerWord = nextStatus === "تایید شده" ? "تایید کرد" : "لغو کرد";
  if (salonBooking && salonBooking.salon_user_id) {
    void sendPushToUser(Number(salonBooking.salon_user_id), {
      title: nextStatus === "تایید شده" ? "نوبت توسط آرتیست تایید شد" : "نوبت توسط آرتیست لغو شد",
      body: `${current.client || "مشتری"} — ${current.service || "نوبت"}: آرتیست ${answerWord}.`
    });
  }

  if (current.clientUserId) {
    void sendPushToUser(Number(current.clientUserId), {
      title: nextStatus === "تایید شده" ? "نوبت شما تایید شد" : "نوبت شما لغو شد",
      body: `${current.service || "نوبت"} — ${current.bookingDate || ""} ${current.time || ""}`.trim()
    });
  }

  return json({
    data: {
      booking: await artists.getArtistBookingById(bookingId),
      bookings: await artists.listArtistBookings(artistUserId)
    }
  });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (body.kind === "collab") {
    const ok = await artists.deleteArtistCollab(Number(body.id), auth.user.id);
    if (!ok) return notFound();
    return json({ data: { ok: true } });
  }
  const ok = await artists.deleteArtistService(Number(body.id), auth.user.id);
  if (!ok) return notFound();
  return json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
