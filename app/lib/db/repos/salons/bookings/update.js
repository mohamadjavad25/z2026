/**
 * Changing the salon's own booking row: every rule a change must pass (still alive, still inside the salon's hours,
 * no clash in the day) and the write itself. The artists' calendar copies follow in ./patch.js.
 */
import { getDb, withTransaction, get, run } from "../../../connection.js";
import { lockSalonDay } from "../../../locks.js";
import { requestStarted, salonRequestLapsedSql } from "../../openRequests.js";
import { resolveBookingServiceEmoji } from "../../serviceEmoji.js";
import { visitSlotProblem } from "../../../../visitSlotRules.js";
import { isSlotInPast } from "../../../../../shared/lib/slots.js";
import { resolveRollingPersianDateKey } from "../../../../../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel, parseServiceDurationMinutes } from "../../../../../shared/lib/time.js";
import { parseBookingParts, serializeBookingParts, summarizeBookingParts } from "../../../../../shared/lib/bookingParts.js";
import { AWAITING_CLIENT } from "../../../../../shared/lib/bookingOffer.js";
import { isProposalLapsed } from "../../../../../shared/lib/providerRules.js";
import { listSalonServices } from "../services.js";
import { listSalonHours } from "../hours.js";
import { recordCancellation } from "./cancellation.js";
import { ensureBookingPartsColumns } from "./columns.js";
import { findOverlapConflict } from "./day.js";
import { cameFromContactRequest } from "../../contactRequests.js";
import { invalidateUnavailable } from "./unavailable.js";

export function buildSalonBookingNext(current, data) {
  const next = {
    client: data.client ?? current.client,
    phone: data.phone ?? current.phone,
    service: data.service ?? current.service,
    service_emoji: current.service_emoji || "",
    staff: data.staff ?? current.staff,
    booking_date: resolveRollingPersianDateKey(data.booking_date ?? data.bookingDate ?? data.date ?? current.booking_date),
    time: normalizeBookingTimeLabel(data.time ?? current.time),
    duration_minutes: Number(data.durationMinutes ?? data.duration_minutes ?? current.duration_minutes) || 60,
    status: data.status ?? current.status
  };
  if (data.duration && data.durationMinutes == null && data.duration_minutes == null) {
    next.duration_minutes = parseServiceDurationMinutes(data.duration);
  }
  next.duration_minutes = Math.max(15, Number(next.duration_minutes) || 60);
  return next;
}

/** Salon-row update inside an open transaction (no BEGIN/COMMIT of its own). */
export async function updateSalonBookingInTx(db, id, salonUserId, current, data) {
  const next = buildSalonBookingNext(current, data);
  await lockSalonDay(db, salonUserId, next.booking_date);
  // `current` was read before this transaction began. Someone else (the client cancelling, the
  // salon approving, the expiry sweep) may have changed the row since; look again, holding the
  // row, and refuse rather than act on a stale picture (e.g. approve a request that just expired).
  const locked = await get(db, `
    SELECT b.status, b.proposal_at, ${salonRequestLapsedSql("b")} AS lapsed
    FROM salon_bookings b WHERE b.id = $1 AND b.salon_user_id = $2 FOR UPDATE
  `, [id, salonUserId]);
  if (!locked) return { ok: false, error: "missing" };
  if (locked.status !== current.status) {
    if (locked.status === "منقضی شده") return { ok: false, error: "expired" };
    if (locked.status === "لغو") return { ok: false, error: "inactive" };
    return { ok: false, error: "stale" };
  }
  // The client accepting a proposal (another time or artist for a confirmed booking): it must still be the very
  // proposal they saw (not withdrawn or replaced meanwhile) and not past its deadline.
  if (data.acceptProposal) {
    if (!locked.proposal_at || new Date(locked.proposal_at).getTime() !== Number(data.acceptProposal.at)) return { ok: false, error: "stale" };
    if (isProposalLapsed({ proposal_at: locked.proposal_at, booking_date: current.booking_date, time: current.time })) return { ok: false, error: "proposal_lapsed" };
  }
  // A request is answered only while it is alive: its window has not run out (live, not "when the sweep gets there")
  // and its appointment has not started. A request the salon can no longer keep its word on -- the day closed, the
  // hours shrunk, the service deleted since it was sent -- cannot be approved either.
  if (next.status === "تایید شده" && ["درخواست", AWAITING_CLIENT].includes(current.status)) {
    if (locked.lapsed || requestStarted(current)) return { ok: false, error: "expired" };
    // A request a client sent before the salon was on frfro (contact_requests) was made without its hours or menu:
    // the salon may accept it as it is (code review 2026-11-12); the started and lapsed checks above still hold.
    if (current.status === "درخواست" && !(await cameFromContactRequest("salon", id, db))) {
      const hours = await listSalonHours(salonUserId, db);
      const problem = visitSlotProblem({
        hours,
        bookingDateKey: next.booking_date,
        time: next.time,
        durationMinutes: next.duration_minutes,
        isClient: false
      });
      const menu = new Set((await listSalonServices(salonUserId, db)).map((item) => String(item.name || "").trim()));
      const wanted = parseBookingParts(current.parts).length >= 2
        ? parseBookingParts(current.parts).map((part) => part.service)
        : [String(next.service || "").trim()];
      const missing = wanted.find((name) => !menu.has(name));
      if (problem || missing) {
        return {
          ok: false,
          error: "unavailable",
          message: missing
            ? `«${missing}» دیگه توی کارهای سالن نیست؛ این درخواست رو لغو کن.`
            : `${problem.error} این درخواست رو لغو کن یا یه ساعت دیگه پیشنهاد بده.`
        };
      }
    }
  }
  // Re-snapshot the icon only when the service itself changed.
  if (String(next.service || "") !== String(current.service || "")) {
    next.service_emoji = await resolveBookingServiceEmoji(db, {
      kind: "salon",
      ownerId: salonUserId,
      service: next.service,
      explicit: data.serviceEmoji ?? data.service_emoji
    });
  }

  // A multi-service booking: its service text and length follow its parts; staff stays empty
  // on the row itself (each part carries its own artist).
  const nextParts = data.parts !== undefined ? serializeBookingParts(data.parts) : (current.parts || "");
  if (nextParts) {
    const summary = summarizeBookingParts(nextParts);
    next.service = summary.service;
    next.duration_minutes = summary.durationMinutes;
    next.staff = "";
  }

  if (data.acceptProposal && (next.booking_date !== current.booking_date || next.time !== normalizeBookingTimeLabel(current.time || ""))) {
    // A proposed time must still be a real in-hours slot when the client says yes (hours may have changed since).
    const hours = await listSalonHours(salonUserId, db);
    const problem = isSlotInPast(next.booking_date, next.time) ? { error: "این ساعت گذشته." } : visitSlotProblem({
      hours,
      bookingDateKey: next.booking_date,
      time: next.time,
      durationMinutes: next.duration_minutes,
      isClient: false
    });
    if (problem) return { ok: false, error: "unavailable", message: problem.error };
  }

  if (next.status !== "لغو" && next.status !== "منقضی شده") {
    const conflict = await findOverlapConflict(db, {
      salonUserId,
      bookingDate: next.booking_date,
      time: next.time,
      durationMinutes: next.duration_minutes,
      staff: next.staff,
      parts: nextParts,
      excludeId: id
    });
    if (conflict) {
      return {
        ok: false,
        error: "conflict",
        message: nextParts && conflict.conflictStaff
          ? `${conflict.conflictStaff} این ساعت توی سالن یه نوبت دیگه داره.`
          : undefined
      };
    }
  }

  await run(db, `
    UPDATE salon_bookings
    SET client = $1, phone = $2, service = $3, staff = $4, booking_date = $5, time = $6, duration_minutes = $7, status = $8, service_emoji = $9
    WHERE id = $10 AND salon_user_id = $11
  `, [
    next.client || "",
    next.phone || "",
    next.service || "",
    next.staff || "",
    next.booking_date || "",
    next.time || "",
    next.duration_minutes,
    next.status || "تازه",
    next.service_emoji || "",
    id,
    salonUserId
  ]);
  if (nextParts !== (current.parts || "")) {
    await run(db, "UPDATE salon_bookings SET parts = $1 WHERE id = $2 AND salon_user_id = $3", [nextParts, id, salonUserId]);
  }
  if (data.previousSlot) {
    await run(db, `
      UPDATE salon_bookings SET previous_booking_date = $1, previous_time = $2, offer_at = NOW() WHERE id = $3 AND salon_user_id = $4
    `, [data.previousSlot.date || "", data.previousSlot.time || "", id, salonUserId]);
  }
  // Who cancelled it, and the provider's cancellation counter (owner's rules of 2026-10-22): only the transaction that
  // really moved the booking from confirmed to cancelled counts, so two simultaneous taps count once.
  if (next.status === "لغو" && current.status !== "لغو" && data.cancelledBy) {
    await recordCancellation(db, "salon_bookings", id, current.status, data.cancelledBy);
  }
  // A proposal ends as soon as the booking changes in any way (cancelled, moved, re-assigned, accepted).
  const changedSlot = next.status !== "تایید شده" || next.booking_date !== current.booking_date
    || next.time !== normalizeBookingTimeLabel(current.time || "") || String(next.staff || "") !== String(current.staff || "")
    || nextParts !== (current.parts || "");
  if (changedSlot) {
    await run(db, "UPDATE salon_bookings SET proposal_date = '', proposal_time = '', proposal_staff = '', proposal_from = '', proposal_at = NULL WHERE id = $1 AND proposal_at IS NOT NULL", [id]);
  }

  return {
    ok: true,
    booking: await get(db, "SELECT * FROM salon_bookings WHERE id = $1", [id])
  };
}

export async function updateSalonBooking(id, salonUserId, data) {
  await ensureBookingPartsColumns();
  const pool = await getDb();
  const current = await get(pool, `
    SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2
  `, [id, salonUserId]);
  if (!current) return { ok: false, error: "missing" };

  const result = await withTransaction(null, (db) => updateSalonBookingInTx(db, id, salonUserId, current, data));
  invalidateUnavailable(salonUserId);
  return result;
}
