import { getDb, withTransaction, all, get, run } from "../connection.js";
import { lockVisitDay } from "../locks.js";
import * as salons from "./salons.js";
import * as users from "./users.js";
import { recordCancellation } from "./salons/bookings.js";
import { bookingStartMs } from "../../../shared/lib/reminderTiming.js";
import { formatPersianDateKey } from "../../../shared/lib/persianCalendar.js";
import { isMultiPartBooking, parseBookingParts, serializeBookingParts } from "../../../shared/lib/bookingParts.js";
import { NEAR_BOOKING_HOURS } from "../../../shared/lib/providerRules.js";
import { noticeClientCancelledByProvider } from "../../providerNotices.js";
import { notifyConnection } from "../../connectionNotify.js";
import { salonGone } from "../../artistPlaceRelease.js";

/**
 * Leaving: a salon or artist deleting their account, an artist leaving a salon team, a salon removing a team member
 * (owner's rules of 2026-10-22, docs/DECISIONS.md). A CONFIRMED booking is never broken without the client being told:
 *  - a confirmed booking starting within NEAR_BOOKING_HOURS (24) blocks it ("near"); only a per-booking cancel with
 *    notice (cancelExitBooking) can clear it;
 *  - farther confirmed bookings must be resolved one by one (cancelled with notice, or for a team member handed to another
 *    artist who the client accepts: bookingProposals.proposeSalonHandover), or all cancelled together with `cancelAll`
 *    («لغو همهٔ نوبت‌ها و ارسال پیامک»);
 *  - waiting requests (not confirmed yet) are closed with notice when a salon or an independent artist leaves, and go back to
 *    the salon unassigned when a team member leaves.
 * The routes enforce this on the server; the dialogs only show what this returns.
 */

const SALON_LIVE = ["تازه", "درخواست", "تایید شده", "در انتظار مشتری"];
const ARTIST_LIVE = ["تازه", "درخواست", "تایید", "تایید شده", "در انتظار مشتری"];
const SALON_CONFIRMED = ["تایید شده", "تازه"];
const ARTIST_CONFIRMED = ["تایید شده", "تایید"];

/** What a person leaving is leaving: { salonOwnerId } a salon account; { artistId } an artist account; { teamSalonId, names, artistId? } one team. */
function staffNameSet(rows) {
  return new Set(rows.map((row) => String(row.name || "").trim()).filter(Boolean));
}

function assignedTo(booking, names) {
  if (isMultiPartBooking(booking)) return parseBookingParts(booking.parts).some((part) => names.has(String(part.staff || "").trim()));
  return names.has(String(booking.staff || "").trim());
}

function toItem(kind, row, { confirmedStatuses, team = false, now }) {
  const date = row.booking_date || "";
  const time = row.time || "";
  const minutes = Math.max(15, Number(row.duration_minutes) || 60);
  const start = bookingStartMs(date, time, now);
  const confirmed = confirmedStatuses.includes(row.status);
  const clientName = (kind === "salon" ? row.client : row.client_name) || "";
  const clientPhone = (kind === "salon" ? row.phone : row.client_phone) || "";
  const end = start === null ? null : start + minutes * 60000;
  return {
    kind,
    id: row.id,
    status: row.status,
    confirmed,
    date,
    time,
    minutes,
    startMs: start,
    endMs: end,
    near: confirmed && start !== null && start <= now.getTime() + NEAR_BOOKING_HOURS * 3600 * 1000,
    service: row.service || "",
    clientName,
    clientPhone,
    clientUserId: row.client_user_id || null,
    hasAccount: Boolean(row.client_user_id),
    staff: kind === "salon" ? (isMultiPartBooking(row) ? [...new Set(parseBookingParts(row.parts).map((part) => String(part.staff || "").trim()).filter(Boolean))] : [String(row.staff || "").trim()].filter(Boolean)) : [],
    team,
    salonUserId: kind === "salon" ? row.salon_user_id : row.source_salon_user_id || null,
    proposalPending: Boolean(row.proposal_at && row.proposal_staff),
    row
  };
}

const notEnded = (item, now) => item.endMs === null || item.endMs > now.getTime();

async function collectSalon(salonUserId, now) {
  const rows = await all(await getDb(), "SELECT * FROM salon_bookings WHERE salon_user_id = $1 AND status = ANY($2) ORDER BY booking_date, time", [Number(salonUserId), SALON_LIVE]);
  return rows.map((row) => toItem("salon", row, { confirmedStatuses: SALON_CONFIRMED, now })).filter((item) => notEnded(item, now));
}

async function collectDirect(artistId, now) {
  const rows = await all(await getDb(), "SELECT * FROM artist_bookings WHERE artist_user_id = $1 AND source_salon_user_id IS NULL AND status = ANY($2) ORDER BY booking_date, time", [Number(artistId), ARTIST_LIVE]);
  return rows.map((row) => toItem("artist", row, { confirmedStatuses: ARTIST_CONFIRMED, now })).filter((item) => notEnded(item, now));
}

async function collectTeam(salonUserId, names, now) {
  if (!names.size) return [];
  const rows = await all(await getDb(), "SELECT * FROM salon_bookings WHERE salon_user_id = $1 AND status = ANY($2) ORDER BY booking_date, time", [Number(salonUserId), SALON_LIVE]);
  return rows.filter((row) => assignedTo(row, names)).map((row) => toItem("salon", row, { confirmedStatuses: SALON_CONFIRMED, team: true, now })).filter((item) => notEnded(item, now));
}

/** Splits the items: near (blocks), far confirmed (to resolve), waiting requests (closed or handed back). */
function classify(items) {
  const near = items.filter((item) => item.near);
  const farConfirmed = items.filter((item) => item.confirmed && !item.near);
  const waiting = items.filter((item) => !item.confirmed);
  return { near, farConfirmed, waiting, unresolved: farConfirmed.filter((item) => !item.proposalPending) };
}

/**
 * The plan for one kind of leaving. `scope`: "account" (user = a salon or artist), "team" (an artist leaves salon
 * `salonUserId`) or "staff" (the salon removes team member `staffId`). → { items, near, farConfirmed, waiting, unresolved, ... }
 */
export async function planExit({ scope, user = null, salonUserId = null, staffId = null, now = new Date() }) {
  let items = [];
  let staffRows = [];
  if (scope === "account" && user.type === "salon") {
    items = await collectSalon(user.id, now);
  } else if (scope === "account" && user.type === "artist") {
    const direct = await collectDirect(user.id, now);
    const memberships = await all(await getDb(), "SELECT * FROM salon_staff WHERE artist_user_id = $1", [Number(user.id)]);
    const team = [];
    for (const salon of [...new Set(memberships.map((row) => Number(row.salon_user_id)))]) {
      team.push(...await collectTeam(salon, staffNameSet(memberships.filter((row) => Number(row.salon_user_id) === salon)), now));
    }
    items = [...direct, ...team];
    staffRows = memberships;
  } else if (scope === "team") {
    staffRows = await all(await getDb(), "SELECT * FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2", [Number(salonUserId), Number(user.id)]);
    items = await collectTeam(salonUserId, staffNameSet(staffRows), now);
  } else if (scope === "staff") {
    const row = await get(await getDb(), "SELECT * FROM salon_staff WHERE id = $1 AND salon_user_id = $2", [Number(staffId), Number(salonUserId)]);
    staffRows = row ? [row] : [];
    items = await collectTeam(salonUserId, staffNameSet(staffRows), now);
  }
  return { scope, items, staffRows, ...classify(items) };
}

/** What a dialog shows (no raw rows, with each booking's own details and, for a team member, who could take it). */
export async function describePlan(plan) {
  const view = async (item) => {
    let candidates = [];
    if (item.team && item.confirmed && !item.near && item.hasAccount && item.salonUserId && !item.proposalPending) {
      const options = await salons.listBookingStaffOptions(item.id, item.salonUserId).catch(() => null);
      const leaving = staffNameSet(plan.staffRows);
      const wanted = (options?.parts || []).filter((part) => leaving.has(String(part.staff || "").trim()));
      if (wanted.length) {
        candidates = wanted[0].options
          .filter((option) => !leaving.has(option.name) && option.free && !option.away && wanted.every((part) => part.options.some((o) => o.name === option.name && o.free && !o.away)))
          .map((option) => option.name);
      }
    }
    return {
      kind: item.kind,
      id: item.id,
      status: item.status,
      confirmed: item.confirmed,
      near: item.near,
      date: item.date,
      time: item.time,
      service: item.service,
      clientName: item.clientName,
      clientPhone: item.clientPhone,
      hasAccount: item.hasAccount,
      staff: item.staff,
      salonUserId: item.salonUserId,
      team: item.team,
      canHandover: candidates.length > 0,
      candidates,
      proposalPending: item.proposalPending,
      proposalStaff: item.proposalPending ? item.row.proposal_staff : ""
    };
  };
  return {
    scope: plan.scope,
    near: await Promise.all(plan.near.map(view)),
    farConfirmed: await Promise.all(plan.farConfirmed.map(view)),
    unresolved: plan.unresolved.length,
    waiting: plan.waiting.length,
    blocked: plan.near.length > 0,
    needsChoice: plan.near.length === 0 && plan.unresolved.length > 0
  };
}

/** The provider the client booked at, for the notice text. */
async function providerOf(item, fallbackUser) {
  if (item.kind === "salon") {
    const salon = item.salonUserId ? await users.getUserLiteById(Number(item.salonUserId)) : null;
    return { type: "salon", name: salon?.name || fallbackUser?.name || "" };
  }
  return { type: "artist", name: fallbackUser?.name || "" };
}

/**
 * Cancels one booking with notice to the client (push, in-app card via cancelled_by, SMS) and records who cancelled it.
 * `by`: "provider" (counts for `userId` when the booking was confirmed) or "gone" (the salon or artist is leaving
 * frfro). `purgeMirrorOf`: artist ids whose calendar copies of it are removed at once (a team member who leaves).
 */
export async function cancelItem(item, { by = "provider", userId = null, actor = null, purgeMirrorOf = [] } = {}) {
  if (item.kind === "salon") {
    const result = await salons.patchSalonBookingWithArtistSync(item.id, item.salonUserId, { status: "لغو" }, { cancelledBy: { by, userId } });
    if (!result.ok) return result;
    if (purgeMirrorOf.length) await purgeMirrors(item.salonUserId, purgeMirrorOf, item);
    noticeClientCancelledByProvider(item.clientUserId, { provider: await providerOf(item, actor), booking: { kind: "salon", id: item.id, booking_date: item.date, time: item.time, service: item.service }, gone: by === "gone" });
    return { ok: true, booking: result.booking };
  }
  const done = await withTransaction(null, async (tx) => {
    const locked = await get(tx, "SELECT * FROM artist_bookings WHERE id = $1 AND artist_user_id = $2 AND status = ANY($3) FOR UPDATE", [item.id, Number(actor?.id || item.row.artist_user_id), ARTIST_LIVE]);
    if (!locked) return null;
    await run(tx, "UPDATE artist_bookings SET status = 'لغو', proposal_date = '', proposal_time = '', proposal_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [item.id]);
    await recordCancellation(tx, "artist_bookings", item.id, locked.status, { by, userId });
    return locked;
  });
  if (!done) return { ok: false, error: "inactive" };
  noticeClientCancelledByProvider(item.clientUserId, { provider: await providerOf(item, actor), booking: { kind: "artist", id: item.id, booking_date: item.date, time: item.time, service: item.service }, gone: by === "gone" });
  return { ok: true };
}

/** Removes the artists' calendar copies of one salon booking, at once (not kept as cancelled history). */
async function purgeMirrors(salonUserId, artistIds, item) {
  if (!artistIds.length) return;
  const db = await getDb();
  await run(db, `
    DELETE FROM artist_bookings
    WHERE source_salon_user_id = $1 AND artist_user_id = ANY($2)
      AND (salon_booking_id = $3 OR (booking_date = $4 AND client_name = $5 AND client_phone = $6 AND service = $7))
  `, [Number(salonUserId), artistIds.map(Number), Number(item.id), item.date, item.clientName, item.clientPhone, item.row.service || ""]);
}

/**
 * A team member's departure for the bookings still assigned to them: waiting requests (and a confirmed booking whose
 * handover the client has not answered yet) are un-assigned, so the salon sees them again without an artist, and every
 * upcoming calendar copy of theirs for that salon goes.
 */
async function detachFromTeam({ salonUserId, artistId, names, now }) {
  const rows = await all(await getDb(), "SELECT * FROM salon_bookings WHERE salon_user_id = $1 AND status = ANY($2)", [Number(salonUserId), SALON_LIVE]);
  for (const row of rows) {
    if (!assignedTo(row, names)) continue;
    await withTransaction(null, async (tx) => {
      await lockVisitDay(tx, salonUserId, row.booking_date, artistId ? [artistId] : []);
      const locked = await get(tx, "SELECT * FROM salon_bookings WHERE id = $1 FOR UPDATE", [row.id]);
      if (!locked || !SALON_LIVE.includes(locked.status)) return;
      if (isMultiPartBooking(locked)) {
        const parts = parseBookingParts(locked.parts).map((part) => (names.has(String(part.staff || "").trim()) ? { ...part, staff: "" } : part));
        await run(tx, "UPDATE salon_bookings SET parts = $1 WHERE id = $2", [serializeBookingParts(parts), locked.id]);
      } else if (names.has(String(locked.staff || "").trim())) {
        await run(tx, "UPDATE salon_bookings SET staff = '' WHERE id = $1", [locked.id]);
      }
    });
  }
  if (artistId) {
    const today = formatPersianDateKey(now);
    const copies = await all(await getDb(), "SELECT id, booking_date, time, duration_minutes FROM artist_bookings WHERE artist_user_id = $1 AND source_salon_user_id = $2 AND booking_date >= $3", [Number(artistId), Number(salonUserId), today]);
    const ids = copies.filter((copy) => {
      const start = bookingStartMs(copy.booking_date, copy.time, now);
      return start === null || start + Math.max(15, Number(copy.duration_minutes) || 60) * 60000 > now.getTime();
    }).map((copy) => copy.id);
    if (ids.length) await run(await getDb(), "DELETE FROM artist_bookings WHERE id = ANY($1)", [ids]);
  }
  salons.invalidateUnavailable?.(salonUserId);
}

const BLOCKED = (plan) => ({ ok: false, code: "NEAR_BOOKINGS", plan });
const NEEDS_CHOICE = (plan) => ({ ok: false, code: "HAS_BOOKINGS", plan });

/** Cancels, with notice, every far confirmed booking of a team plan that is still unresolved. */
async function cancelOpen(plan, { by, userId, actor }) {
  // Only what has no handover waiting on the client's answer: those continue as proposed.
  const targets = [...plan.unresolved];
  const artistIds = plan.staffRows.map((row) => row.artist_user_id).filter(Boolean);
  for (const item of targets) await cancelItem(item, { by, userId, actor, purgeMirrorOf: item.team ? artistIds : [] });
}

/**
 * An artist leaves salon `salonUserId`'s team, or the salon removes `staffId`. → { ok: true } after it happened, else
 * { ok: false, code: "NEAR_BOOKINGS" | "HAS_BOOKINGS", plan } (the dialogs read the plan).
 * `actor` is the person asking: the salon owner (removal) or the artist (leaving); their counter takes the cancellations.
 */
export async function leaveOrRemoveFromTeam({ scope, actor, salonUserId, staffId = null, cancelAll = false }) {
  const now = new Date();
  const plan = await planExit({ scope, user: actor, salonUserId, staffId, now });
  if (scope === "staff" && !plan.staffRows.length) return { ok: false, code: "NOT_FOUND" };
  if (scope === "team" && !plan.staffRows.length) return { ok: false, code: "NOT_MEMBER" };
  if (plan.near.length) return BLOCKED(plan);
  if (plan.unresolved.length && !cancelAll) return NEEDS_CHOICE(plan);
  await cancelOpen(plan, { by: "provider", userId: actor.id, actor });
  const after = await planExit({ scope, user: actor, salonUserId, staffId, now: new Date() });
  if (after.near.length) return BLOCKED(after);
  const names = staffNameSet(plan.staffRows);
  const artistId = plan.staffRows.find((row) => row.artist_user_id)?.artist_user_id || null;
  await detachFromTeam({ salonUserId, artistId, names, now: new Date() });
  return { ok: true, plan, artistId, removedStaff: plan.staffRows };
}

/**
 * Deletes a salon's or artist's own account (or an admin does it: `byAdmin`, no 24-hour block). Order: check the plan
 * (blocked / needs a choice), cancel what is open with notice (`gone`), close or hand back waiting requests, look again for
 * a confirmed booking that appeared meanwhile, delete. Anything still live after the row is gone (a booking that slipped in
 * during these steps) is closed by closeOrphanBookings straight away and by the sweep later.
 */
export async function deleteProviderAccount({ user, cancelAll = false, byAdmin = false }) {
  if (!["salon", "artist"].includes(user.type)) {
    await users.deleteUserDetachingPhone(user.id);
    return { ok: true };
  }
  const now = new Date();
  const plan = await planExit({ scope: "account", user, now });
  if (!byAdmin && plan.near.length) return BLOCKED(plan);
  if (!byAdmin && plan.unresolved.length && !cancelAll) return NEEDS_CHOICE(plan);
  // Everything confirmed and still ahead is cancelled (an admin's delete cancels the near ones too), then the waiting ones.
  const everyConfirmed = byAdmin ? [...plan.near, ...plan.farConfirmed] : plan.farConfirmed;
  for (const item of everyConfirmed) {
    if (item.team) continue;
    await cancelItem(item, { by: "gone", userId: user.id, actor: user });
  }
  for (const item of plan.waiting) {
    if (item.team) continue;
    await cancelItem(item, { by: "gone", userId: user.id, actor: user });
  }
  if (user.type === "artist") {
    // The salons the artist worked for: confirmed team bookings are cancelled (by provider: the salon is staying),
    // waiting ones go back to the salon unassigned; every salon is told.
    const memberships = await all(await getDb(), "SELECT * FROM salon_staff WHERE artist_user_id = $1", [Number(user.id)]);
    for (const salon of [...new Set(memberships.map((row) => Number(row.salon_user_id)))]) {
      const rows = memberships.filter((row) => Number(row.salon_user_id) === salon);
      const names = staffNameSet(rows);
      const teamPlan = classify(await collectTeam(salon, names, new Date()));
      // Bookings whose handover the client has not answered yet are left to the handover (they are un-assigned below);
      // an admin's delete cancels every one of them.
      for (const item of byAdmin ? [...teamPlan.near, ...teamPlan.farConfirmed] : teamPlan.unresolved) {
        await cancelItem(item, { by: "provider", userId: user.id, actor: user, purgeMirrorOf: [user.id] });
      }
      await detachFromTeam({ salonUserId: salon, artistId: user.id, names, now: new Date() });
      notifyConnection(salon, { title: "یه آرتیست از تیم رفت", body: `${user.name || "یه آرتیست"} حسابش رو پاک کرد؛ نوبت‌هایی که آرتیست ندارن رو ببین.`, url: "/" });
    }
  }
  if (!byAdmin) {
    const after = await planExit({ scope: "account", user, now: new Date() });
    if (after.near.length) return BLOCKED(after);
  }
  // A salon's direct bookings (clients an artist receives there) move back to the artist's own place, with notice.
  if (user.type === "salon") await salonGone({ salonUserId: user.id, salonName: user.name || "" });
  await users.deleteUserDetachingPhone(user.id);
  await closeOrphanBookings();
  return { ok: true };
}

/**
 * Bookings whose salon or artist no longer exists (an older deletion, or one that raced with a new booking) are closed
 * with the same notice as a deletion: «… دیگر در فرفرو نیست». Past confirmed ones are history and stay. Returns how many.
 */
export async function closeOrphanBookings(now = new Date()) {
  const db = await getDb();
  let closed = 0;
  for (const [kind, table, ownerColumn, live] of [["salon", "salon_bookings", "salon_user_id", SALON_LIVE], ["artist", "artist_bookings", "artist_user_id", ARTIST_LIVE]]) {
    const rows = await all(db, `SELECT * FROM ${table} WHERE ${ownerColumn} IS NULL AND status = ANY($1)${kind === "artist" ? " AND source_salon_user_id IS NULL" : ""}`, [live]);
    for (const row of rows) {
      const item = toItem(kind, row, { confirmedStatuses: kind === "salon" ? SALON_CONFIRMED : ARTIST_CONFIRMED, now });
      if (item.confirmed && !notEnded(item, now)) continue;
      const result = await run(db, `
        UPDATE ${table} SET status = 'لغو', cancelled_by = 'gone', proposal_date = '', proposal_time = '', ${kind === "salon" ? "proposal_staff = '', proposal_from = ''," : ""} proposal_at = NULL
        WHERE id = $1 AND ${ownerColumn} IS NULL AND status = ANY($2)
      `, [row.id, live]);
      if (result.rowCount) {
        closed += 1;
        noticeClientCancelledByProvider(row.client_user_id, { provider: { type: kind === "salon" ? "salon" : "artist", name: "" }, booking: { kind, id: row.id, booking_date: row.booking_date, time: row.time, service: row.service }, gone: true });
      }
    }
  }
  return closed;
}
