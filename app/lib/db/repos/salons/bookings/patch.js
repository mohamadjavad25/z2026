/**
 * A change to a salon booking together with the artists' calendar copies, in one transaction: approve, cancel, move,
 * hand to another artist, expire. This is the path the salon's own actions, the client's answers and the sweeps use.
 */
import { getDb, withTransaction, get, run } from "../../../connection.js";
import { lockVisitDay } from "../../../locks.js";
import { addArtistBookingInTx, cancelArtistBookingRow, findLinkedSalonArtistBooking, updateArtistBookingRow } from "../../artists/bookings.js";
import { isArtistSlotBlocked } from "../../artists/calendar.js";
import { formatPersianDateKey, isPersianDateKey, resolveRollingPersianDateKey } from "../../../../../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel } from "../../../../../shared/lib/time.js";
import { bookingPeople, groupConsecutiveParts, isMultiPartBooking, parseBookingParts } from "../../../../../shared/lib/bookingParts.js";
import { AWAITING_CLIENT } from "../../../../../shared/lib/bookingOffer.js";
import { hasStarted } from "../../../../../shared/lib/providerRules.js";
import { SALON_CONFIRMED, SALON_LIVE } from "../../../../../shared/lib/bookingStates.js";
import { findSalonStaffForBooking } from "../bookingStaff.js";
import { listSalonStaff } from "../staff.js";
import { ensureBookingPartsColumns } from "./columns.js";
import { createPartMirrors, listPartMirrors, mirrorStatus } from "./mirrors.js";
import { invalidateUnavailable } from "./unavailable.js";
import { buildSalonBookingNext, updateSalonBookingInTx } from "./update.js";

export async function patchSalonBookingWithArtistSync(id, salonUserId, data, options = {}) {
  const result = await patchSalonBookingUncached(id, salonUserId, data, options);
  invalidateUnavailable(salonUserId);
  return result;
}

/**
 * A salon moving a client's booking to another day or time does not just move it: the booking
 * waits for the client ('در انتظار مشتری') and remembers the time the client last agreed to,
 * so they see what changed and accept or decline it (answerSalonTimeOffer). Bookings with no
 * client account (walk-ins the salon entered) move as before.
 */
function withClientConsent(current, data) {
  if (!current.client_user_id || data.status === "لغو") return data;
  if (!SALON_LIVE.includes(current.status)) return data;
  const nextDate = resolveRollingPersianDateKey(data.booking_date ?? data.bookingDate ?? data.date ?? current.booking_date);
  const nextTime = normalizeBookingTimeLabel(data.time ?? current.time);
  if (nextDate === current.booking_date && nextTime === normalizeBookingTimeLabel(current.time || "")) return data;
  const waiting = current.status === AWAITING_CLIENT;
  return {
    ...data,
    status: AWAITING_CLIENT,
    previousSlot: waiting
      ? { date: current.previous_booking_date, time: current.previous_time }
      : { date: current.booking_date, time: normalizeBookingTimeLabel(current.time || "") }
  };
}

/**
 * PATCH-path update: salon_bookings + linked artist_bookings in one atomic transaction.
 *
 * Staff-link policy:
 * - Same linked artist → update mirrored artist row (time/date/service/status/…).
 * - Cancel → soft-cancel mirrored artist row (status لغو).
 * - Linked A → unlinked staff → soft-cancel A's artist booking (no delete).
 * - Linked A → linked B → soft-cancel A, create on B (artist slot conflict rolls back both tables).
 * - Unlinked → linked B → create on B.
 */
async function patchSalonBookingUncached(id, salonUserId, data, options = {}) {
  const { allowPast = false, askClient = false, clientAnswer = false } = options;
  if (options.cancelledBy) data = { ...data, cancelledBy: options.cancelledBy };
  if (options.acceptProposal) data = { ...data, acceptProposal: options.acceptProposal };
  await ensureBookingPartsColumns();
  const pool = await getDb();
  const current = await get(pool, `
    SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2
  `, [id, salonUserId]);
  if (!current) return { ok: false, error: "missing" };
  // The caller acts only on a booking in one known state (the client answering an offered time).
  if (options.expectStatus && current.status !== options.expectStatus) return { ok: false, error: "inactive" };

  // Past bookings are review-only. Persian date keys (YYYY-MM-DD, zero
  // padded) sort lexicographically, so a plain string compare is enough.
  // The expiry sweep is the one caller allowed to close a request whose day went by unanswered.
  if (!allowPast && isPersianDateKey(current.booking_date) && current.booking_date < formatPersianDateKey(new Date())) {
    return { ok: false, error: "past" };
  }
  // A confirmed visit that has started is no longer the salon's to cancel: «نیومد» takes its place
  // (owner's decision of 2026-10-25; /api/booking-no-show). The client's own cancel stops at the start too.
  if (data.status === "لغو" && options.cancelledBy?.by === "provider" && SALON_CONFIRMED.includes(current.status)
    && hasStarted(current.booking_date, current.time)) {
    return { ok: false, error: "started" };
  }

  // An already-expired request (bookingExpirySweep.js) already told the client
  // "the salon never answered in time" and freed its slot — it must not be
  // silently resurrected back to "تایید شده" through the normal confirm PATCH
  // (that would re-serve a client who was already told the request timed out,
  // with zero notification that it happened). Cancel-to-"لغو" is intentionally
  // left alone here — cancelling an already-expired row is a harmless no-op,
  // not a resurrection.
  if (current.status === "منقضی شده" && data.status === "تایید شده") {
    return { ok: false, error: "expired" };
  }
  // A new time the salon offered is the client's to accept; the salon may still cancel or move it again.
  if (current.status === AWAITING_CLIENT && data.status === "تایید شده" && !clientAnswer) {
    return { ok: false, error: "awaiting_client" };
  }
  // A cancelled booking stays cancelled (to book again, make a new one).
  if (current.status === "لغو" && data.status && data.status !== "لغو" && data.status !== "منقضی شده") {
    return { ok: false, error: "inactive" };
  }
  // Only a request still waiting can time out; an approved or cancelled booking never expires.
  if (data.status === "منقضی شده" && !["درخواست", AWAITING_CLIENT].includes(current.status)) {
    return { ok: false, error: "inactive" };
  }
  // A confirmed booking is never moved on the salon's word alone: its new time is a proposal the client accepts
  // (bookingProposals.js); the original stays valid until then. The route sends it there first; this is the safety net.
  if (askClient && current.client_user_id && SALON_CONFIRMED.includes(current.status) && data.status !== "لغو"
    && (data.time != null || data.booking_date != null || data.bookingDate != null || data.date != null)) {
    const nextDate = resolveRollingPersianDateKey(data.booking_date ?? data.bookingDate ?? data.date ?? current.booking_date);
    const nextTime = normalizeBookingTimeLabel(data.time ?? current.time);
    if (nextDate !== current.booking_date || nextTime !== normalizeBookingTimeLabel(current.time || "")) return { ok: false, error: "needs_proposal" };
  }
  if (askClient) data = withClientConsent(current, data);

  if (isMultiPartBooking(current)) {
    return patchMultiPartBooking(id, salonUserId, current, data);
  }

  const oldStaff = await findSalonStaffForBooking(salonUserId, current.staff, current.service, pool);
  const oldArtistId = oldStaff?.artist_user_id ? Number(oldStaff.artist_user_id) : null;
  const oldArtistBooking = oldArtistId
    ? await findLinkedSalonArtistBooking(oldArtistId, salonUserId, current, pool)
    : null;

  try {
    return await withTransaction(null, async (db) => {
      const salonResult = await updateSalonBookingInTx(db, id, salonUserId, current, data);
      if (!salonResult.ok) return salonResult;

      const next = salonResult.booking;
      const newStaff = await findSalonStaffForBooking(salonUserId, next.staff, next.service, db);
      const newArtistId = newStaff?.artist_user_id ? Number(newStaff.artist_user_id) : null;
      const linkedArtistIds = [];
      const cancelled = next.status === "لغو";

      function failArtist(code, error) {
        const err = new Error(error || code);
        err.code = code;
        err.rollbackArtist = true;
        throw err;
      }

      // Isolated-test hook: simulate mid-flight failure after salon row write (must roll back both).
      if (
        process.env.FRFRO_BOOKING_PATCH_SYNC_TEST === "1"
        && data.__testForceFail === true
      ) {
        failArtist("TEST_FORCE_FAIL", "forced patch sync rollback");
      }

      if (cancelled) {
        if (oldArtistBooking) {
          await cancelArtistBookingRow(oldArtistBooking.id, db);
          if (oldArtistId) linkedArtistIds.push(oldArtistId);
        }
      } else if (oldArtistId && newArtistId && oldArtistId === newArtistId) {
        if (oldArtistBooking) {
          // Closing a request (expired) takes nothing, so another live request on the same time (made after this
          // one's hour ran out) must not stop it from being closed.
          if (next.status !== "منقضی شده" && await isArtistSlotBlocked(
            newArtistId,
            next.booking_date,
            next.time,
            next.duration_minutes,
            oldArtistBooking.id,
            db
          )) {
            failArtist("ARTIST_SLOT_TAKEN", "آرتیست این ساعت نوبت داره؛ یه ساعت دیگه بزن.");
          }
          await updateArtistBookingRow(oldArtistBooking.id, {
            client: next.client,
            phone: next.phone,
            service: next.service,
            service_emoji: next.service_emoji,
            booking_date: next.booking_date,
            time: next.time,
            duration_minutes: next.duration_minutes,
            status: mirrorStatus(next.status, oldArtistBooking.status)
          }, db);
        } else {
          const created = await addArtistBookingInTx(newArtistId, {
            client: next.client,
            phone: next.phone,
            service: next.service,
            serviceEmoji: next.service_emoji,
            bookingDate: next.booking_date,
            time: next.time,
            durationMinutes: next.duration_minutes,
            sourceSalonUserId: salonUserId,
            status: mirrorStatus(next.status)
          }, db);
          if (!created.ok) failArtist(created.code || "ARTIST_BOOKING_FAILED", created.error);
        }
        linkedArtistIds.push(newArtistId);
      } else {
        if (oldArtistBooking) {
          await cancelArtistBookingRow(oldArtistBooking.id, db);
          if (oldArtistId) linkedArtistIds.push(oldArtistId);
        }
        if (newArtistId) {
          const created = await addArtistBookingInTx(newArtistId, {
            client: next.client,
            phone: next.phone,
            service: next.service,
            serviceEmoji: next.service_emoji,
            bookingDate: next.booking_date,
            time: next.time,
            durationMinutes: next.duration_minutes,
            sourceSalonUserId: salonUserId,
            status: mirrorStatus(next.status)
          }, db);
          if (!created.ok) failArtist(created.code || "ARTIST_BOOKING_FAILED", created.error);
          linkedArtistIds.push(newArtistId);
        }
      }

      const uniqueIds = [...new Set(linkedArtistIds.filter(Boolean))];
      return {
        ok: true,
        booking: next,
        linkedArtistIds: uniqueIds,
        linkedArtistId: uniqueIds.length ? uniqueIds[uniqueIds.length - 1] : null
      };
    });
  } catch (error) {
    if (error?.rollbackArtist) {
      return {
        ok: false,
        error: "artist_conflict",
        code: error.code || "ARTIST_SLOT_TAKEN",
        message: error.message
      };
    }
    throw error;
  }
}

/**
 * Edits of a multi-service booking. The salon may reorder its services and change each one's
 * artist (the same services, nothing added or dropped), move the time, approve, cancel; the
 * expiry sweep may expire it. The artists' calendar copies follow in the same transaction:
 * a status change is copied onto them, any change of who-does-what-when replaces them.
 */
async function patchMultiPartBooking(id, salonUserId, current, data) {
  const pool = await getDb();
  const staffList = await listSalonStaff(salonUserId, pool);
  const currentParts = parseBookingParts(current.parts);
  let nextParts = currentParts;
  if (data.parts !== undefined) {
    const incoming = parseBookingParts(data.parts);
    const servicesOf = (list) => list.map((part) => part.service).sort().join("\n");
    const staffNames = new Set(staffList.map((person) => String(person.name || "").trim()).filter(Boolean));
    if (incoming.length !== currentParts.length || servicesOf(incoming) !== servicesOf(currentParts)
      || incoming.some((part) => part.staff && !staffNames.has(part.staff))) {
      return { ok: false, error: "parts" };
    }
    // Lengths come from the booking itself, never from the request.
    const remaining = [...currentParts];
    // A group keeps its people: the salon may change who does a part, never which person it belongs to.
    const isGroup = bookingPeople(currentParts) > 1;
    if (isGroup && incoming.some((part, index) => part.service !== currentParts[index].service)) return { ok: false, error: "parts" };
    nextParts = isGroup ? incoming.map((part, index) => ({ ...currentParts[index], staff: part.staff })) : incoming.map((part) => {
      const index = remaining.findIndex((item) => item.service === part.service);
      const [original] = remaining.splice(index, 1);
      return { service: part.service, minutes: original.minutes, staff: part.staff };
    });
  }

  try {
    return await withTransaction(null, async (db) => {
      await lockVisitDay(db, salonUserId, buildSalonBookingNext(current, data).booking_date, staffList.map((person) => person.artist_user_id));
      const salonResult = await updateSalonBookingInTx(db, id, salonUserId, current, { ...data, staff: "", parts: nextParts });
      if (!salonResult.ok) return salonResult;
      const next = salonResult.booking;
      const mirrors = await listPartMirrors(db, id);
      const linkedArtistIds = mirrors.map((row) => Number(row.artist_user_id)).filter(Boolean);
      const status = next.status || "تازه";

      if (status === "لغو" || status === "منقضی شده") {
        for (const row of mirrors) {
          await updateArtistBookingRow(row.id, { status }, db);
        }
        return { ok: true, booking: next, linkedArtistIds: [...new Set(linkedArtistIds)], linkedArtistId: linkedArtistIds[0] ?? null };
      }

      const wanted = groupConsecutiveParts(next.time, next.parts)
        .map((group) => {
          const person = staffList.find((item) => String(item.name || "").trim() === group.staff);
          return { ...group, artistId: group.staff ? Number(person?.artist_user_id || 0) : 0 };
        })
        .filter((group) => group.artistId);
      const unchanged = wanted.length === mirrors.length && wanted.every((group) => mirrors.some((row) => (
        Number(row.artist_user_id) === group.artistId
        && normalizeBookingTimeLabel(row.time || "") === group.startLabel
        && Number(row.duration_minutes) === group.minutes
        && row.service === group.service
        && row.booking_date === next.booking_date
      )));

      if (unchanged) {
        for (const row of mirrors) {
          const copyStatus = mirrorStatus(status, row.status);
          if (row.status !== copyStatus) await updateArtistBookingRow(row.id, { status: copyStatus }, db);
        }
        return { ok: true, booking: next, linkedArtistIds: [...new Set(linkedArtistIds)], linkedArtistId: linkedArtistIds[0] ?? null };
      }

      // Who does what, or when, changed: the old copies go (a confirmed visit keeps them as
      // cancelled history, a pending request just drops them) and new ones are made.
      for (const row of mirrors) {
        if (SALON_CONFIRMED.includes(current.status)) await cancelArtistBookingRow(row.id, db);
        else await run(db, "DELETE FROM artist_bookings WHERE id = $1", [row.id]);
      }
      const created = await createPartMirrors(db, salonUserId, next, staffList);
      const ids = [...new Set([...linkedArtistIds, ...created])];
      return { ok: true, booking: next, linkedArtistIds: ids, linkedArtistId: created[0] ?? ids[0] ?? null };
    });
  } catch (error) {
    if (error?.rollbackArtist) {
      return { ok: false, error: "artist_conflict", code: error.code, message: error.message };
    }
    throw error;
  }
}

export async function cancelSalonBooking(id, salonUserId, options = {}) {
  return patchSalonBookingWithArtistSync(id, salonUserId, { status: "لغو" }, options);
}
