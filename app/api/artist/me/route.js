import { error, json, notFound, requireUserRole, withErrorHandling, readObjectBody } from "../../../lib/http.js";
import { checkWaitlistSoon } from "../../../lib/waitlist.js";
import { sweepExpiredBookingRequestsIfDue } from "../../../lib/bookingExpirySweep.js";
import * as artists from "../../../lib/db/repos/artists.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { countFollowers, getUserLiteById } from "../../../lib/db/repos/users.js";
import { sendPushToUser } from "../../../lib/push.js";
import { notifyConnection } from "../../../lib/connectionNotify.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { get, withTransaction } from "../../../lib/db/connection.js";
import { lockArtistDays, lockSalonDay } from "../../../lib/db/locks.js";
import { artistRequestLapsedSql } from "../../../lib/db/repos/openRequests.js";
import { isSlotInPast } from "../../../shared/lib/slots.js";
import { AWAITING_CLIENT } from "../../../shared/lib/bookingOffer.js";
import { SERVICE_LIMIT_MESSAGE, serviceFieldsProblem } from "../../../lib/validation/service.js";
import { readBookingSlot } from "../../../lib/validation/bookingSlot.js";
import { parseRequestedMinutes } from "../../../lib/validation/numbers.js";
import { bookingWhen, smsBookingAnswer } from "../../../lib/bookingSms.js";
import { noticeClientCancelledByProvider } from "../../../lib/providerNotices.js";
import { STARTED_NO_CANCEL_TEXT, STARTED_TEAM_NO_CANCEL_TEXT, hasStarted } from "../../../shared/lib/providerRules.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
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
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  if (body.kind === "booking") {
    // An entry the artist makes in their own calendar is already settled. Left as "تازه" (a client's
    // pending request) the expiry sweep would cancel it an hour later, as if nobody had answered.
    const slot = readBookingSlot(body.bookingDate || body.booking_date || body.date || "", body.time ?? "");
    if (!slot.ok) return error(slot.error, slot.status);
    const length = parseRequestedMinutes(body);
    if (!length.ok) return error(`مدت نوبت رو با عدد و به دقیقه بنویس.`, 400);
    const result = await artists.addArtistBooking(auth.user.id, {
      ...body, bookingDate: slot.dateKey, booking_date: undefined, date: undefined, time: slot.time,
      durationMinutes: length.minutes, duration_minutes: undefined, status: "تایید"
    });
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
    if (!limited.ok) return error("یه کم زیاد زدی؛ چند لحظه صبر کن.", 429);
    const result = await artists.addArtistCollab(auth.user.id, body);
    if (!result.ok) {
      return json({ error: result.error, code: result.code }, { status: result.code === "SALON_NOT_FOUND" ? 404 : 400 });
    }
    notifyConnection(result.collab.salonId, {
      title: "پیشنهاد همکاری تازه",
      body: `${auth.user.name || "یه آرتیست"} می‌خواد با سالنت کار کنه.`,
      url: "/"
    });
    return json({ data: { collab: result.collab } }, { status: 201 });
  }
  const problem = serviceFieldsProblem(body);
  if (problem) return error(problem, 400);
  // A service without a name can't be booked and would only use up one of the 100 places.
  if (typeof body.name !== "string" || !body.name.trim()) return error("اسم کار رو بنویس.", 400);
  const service = await artists.addArtistService(auth.user.id, body);
  if (service?.limit) return json({ error: SERVICE_LIMIT_MESSAGE, code: "SERVICE_LIMIT" }, { status: 409 });
  return json({ data: { service } }, { status: 201 });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  if (body.kind === "booking") {
    return patchOwnArtistBooking(auth.user.id, body, auth.user.name);
  }
  const problem = serviceFieldsProblem(body);
  if (problem) return error(problem, 400);
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
async function patchOwnArtistBooking(artistUserId, body, artistName = "") {
  const bookingId = Number(body.id);
  if (!bookingId) return error("این نوبت رو پیدا نکردیم.", 400);
  const current = await artists.getArtistBookingById(bookingId);
  if (!current || Number(current.artistUserId) !== Number(artistUserId)) return notFound();

  const wantsCancel = body.status === "لغو" || body.action === "cancel";
  const nextStatus = wantsCancel ? "لغو" : body.status;
  if (nextStatus !== "تایید شده" && nextStatus !== "لغو") {
    return error("این جواب رو نفهمیدیم؛ دوباره بزن.", 400);
  }

  // An already-expired request (bookingExpirySweep.js) is a dead end by
  // design: it already freed its slot, so a stale client (e.g. an unrefreshed
  // "تایید"/"رد" button) must not be able to confirm OR decline it back to
  // life. Matches the salon-side guard added in patchSalonBookingWithArtistSync's
  // caller for the same "منقضی شده" resurrection hole.
  if (current.status === "منقضی شده") {
    return error("وقت جواب دادن به این درخواست تموم شده.", 409);
  }

  // The answer is applied under the same locks the booking paths use (salon's day first, then the
  // artist's day), re-reading the row first: the sweep, the client or the salon may have changed it
  // since it was read above, and confirming an expired or cancelled request would bring it back to
  // life. Confirming also re-checks the slot, so a stale-but-not-yet-swept row can never double-book.
  let updatedRow = null;
  let salonBooking = null;
  let refusal = null;
  let statusBefore = null;
  await withTransaction(null, async (db) => {
    if (current.sourceSalonUserId) await lockSalonDay(db, current.sourceSalonUserId, current.bookingDate);
    await lockArtistDays(db, [artistUserId], current.bookingDate);
    const locked = await get(db, `SELECT a.*, ${artistRequestLapsedSql("a")} AS lapsed FROM artist_bookings a WHERE a.id = $1 FOR UPDATE`, [bookingId]);
    if (!locked) return;
    statusBefore = locked.status;
    // One artist's share of a multi-service visit: the visit is approved by the salon, and the
    // shares follow it. Confirming a share alone used to mark it confirmed here while the salon
    // booking -- and so the client -- stayed "waiting", the two sides disagreeing for good.
    // (A visit the salon entered itself is already settled, so its shares may be confirmed.)
    if (nextStatus === "تایید شده" && locked.salon_booking_id) {
      const visit = await get(db, "SELECT status FROM salon_bookings WHERE id = $1", [locked.salon_booking_id]);
      if (visit && ["درخواست", AWAITING_CLIENT].includes(visit.status)) {
        refusal = error("این نوبت بخشی از یه نوبت چندکاره‌ست؛ تأییدش با سالنه.", 409);
        return;
      }
    }
    if (locked.status === "منقضی شده") {
      refusal = error("وقت جواب دادن به این درخواست تموم شده.", 409);
      return;
    }
    // A request can be answered only while it is alive: its window has not run out (decided now, not when the sweep
    // gets there) and its appointment has not started.
    const isRequestRow = (locked.status === "تازه" && !locked.source_salon_user_id) || (locked.status === "درخواست" && locked.source_salon_user_id);
    if (nextStatus === "تایید شده" && isRequestRow && (locked.lapsed || isSlotInPast(locked.booking_date, locked.time))) {
      refusal = json({ error: "وقت جواب دادن به این درخواست تموم شده.", code: "BOOKING_EXPIRED" }, { status: 409 });
      return;
    }
    // A confirmed visit that has started can't be cancelled by its artist any more (owner's decision of 2026-10-25):
    // an independent artist marks «نیومد» instead; a salon's visit is the salon's to mark.
    if (wantsCancel && ["تایید", "تایید شده"].includes(locked.status) && hasStarted(locked.booking_date, locked.time)) {
      refusal = json({
        error: locked.source_salon_user_id ? STARTED_TEAM_NO_CANCEL_TEXT : STARTED_NO_CANCEL_TEXT,
        code: "BOOKING_STARTED"
      }, { status: 409 });
      return;
    }
    if (locked.status === "لغو" && nextStatus === "تایید شده") {
      refusal = error("این نوبت لغو شده و دیگه تأیید نمی‌شه.", 409);
      return;
    }
    if (
      nextStatus === "تایید شده"
      && await artists.isArtistSlotBlocked(artistUserId, current.bookingDate, current.time, current.durationMinutes, bookingId, db)
    ) {
      refusal = error("این ساعت با یه نوبت دیگه‌ت پر شده.", 409);
      return;
    }
    // A salon-assigned appointment (source_salon_user_id) is only a mirror of the salon's own
    // booking: the answer has to land on the salon booking too, in the same transaction, or the
    // salon and the client keep showing the old status.
    updatedRow = wantsCancel
      ? await artists.cancelArtistBookingRow(bookingId, db)
      : await artists.updateArtistBookingRow(bookingId, { status: nextStatus }, db);
    if (updatedRow && updatedRow.source_salon_user_id) {
      salonBooking = await salons.syncSalonBookingFromArtistMirror(updatedRow, nextStatus, db);
    }
    // Who cancelled, and the artist's counter of cancelled CONFIRMED bookings (only this transaction's real change counts).
    if (wantsCancel && updatedRow && statusBefore !== "لغو") {
      await salons.recordCancellation(db, "artist_bookings", bookingId, statusBefore === "تایید" ? "تایید" : statusBefore, { by: "provider", userId: artistUserId });
      await db.query("UPDATE artist_bookings SET proposal_date = '', proposal_time = '', proposal_at = NULL WHERE id = $1", [bookingId]);
    }
  });
  if (refusal) return refusal;
  if (!updatedRow) return notFound();

  // Nobody is told again about an answer that changed nothing (a second tap on «تایید», or «لغو» on a cancelled one).
  if (updatedRow.status === statusBefore) {
    return json({
      data: {
        booking: await artists.getArtistBookingById(bookingId),
        bookings: await artists.listArtistBookings(artistUserId)
      }
    });
  }

  // A cancel or decline frees a time: anyone waiting for that day («خبرم کن») hears about it (a salon visit's own salon too).
  if (nextStatus === "لغو") {
    if (salonBooking?.salon_user_id) checkWaitlistSoon("salon", salonBooking.salon_user_id, salonBooking.booking_date);
    else checkWaitlistSoon("artist", artistUserId, current.bookingDate);
  }

  const answerWord = nextStatus === "تایید شده" ? "تأیید کرد" : "لغو کرد";
  if (salonBooking && salonBooking.salon_user_id) {
    void sendPushToUser(Number(salonBooking.salon_user_id), {
      title: nextStatus === "تایید شده" ? "آرتیست نوبت رو تأیید کرد" : "آرتیست نوبت رو لغو کرد",
      body: `${current.client || "مشتری"}، ${current.service || "نوبت"}: آرتیست ${answerWord}.`
    });
  }

  // Cancelling a booking that was already confirmed is a broken promise: the client gets the apology push + SMS
  // (owner's rule of 2026-10-22), never the plain "cancelled" answer on top of it.
  const confirmedBefore = ["تایید شده", "تایید"].includes(statusBefore);
  if (nextStatus === "لغو" && confirmedBefore) {
    const clientId = Number(current.clientUserId || salonBooking?.client_user_id || 0);
    const viaSalon = salonBooking?.salon_user_id ? await getUserLiteById(Number(salonBooking.salon_user_id)).catch(() => null) : null;
    noticeClientCancelledByProvider(clientId, {
      provider: viaSalon ? { type: "salon", name: viaSalon.name } : { type: "artist", name: artistName },
      booking: viaSalon && salonBooking
        ? { kind: "salon", id: salonBooking.id, booking_date: salonBooking.booking_date, time: salonBooking.time, service: salonBooking.service }
        : { kind: "artist", id: bookingId, booking_date: current.bookingDate, time: current.time, service: current.service }
    });
  } else if (current.clientUserId) {
    const push = sendPushToUser(Number(current.clientUserId), {
      title: nextStatus === "تایید شده" ? "نوبتت تأیید شد" : "نوبتت لغو شد",
      body: `${current.service || "نوبت"}، ${bookingWhen(current.bookingDate, current.time)}`
    }).catch(() => null);
    smsBookingAnswer(Number(current.clientUserId), {
      providerName: artistName,
      bookingDate: current.bookingDate,
      time: current.time,
      confirmed: nextStatus === "تایید شده",
      booking: { kind: "artist", id: bookingId }
    }, push);
  }

  return json({
    data: {
      booking: await artists.getArtistBookingById(bookingId),
      bookings: await artists.listArtistBookings(artistUserId)
    }
  });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
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
