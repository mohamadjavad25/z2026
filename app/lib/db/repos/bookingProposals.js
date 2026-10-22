import { getDb, withTransaction, all, get, run } from "../connection.js";
import { lockArtistDays } from "../locks.js";
import * as artists from "./artists.js";
import * as salons from "./salons.js";
import { clientBookingMatch } from "../clientMatch.js";
import { bookingMoveOptions } from "../../salonMoveTimes.js";
import { artistSlotProblem } from "../../visitSlotRules.js";
import { isSlotInPast } from "../../../shared/lib/slots.js";
import { normalizeBookingTimeLabel } from "../../../shared/lib/time.js";
import { resolveRollingPersianDateKey } from "../../../shared/lib/persianCalendar.js";
import { parseBookingParts, isMultiPartBooking } from "../../../shared/lib/bookingParts.js";
import { PROPOSAL_MIN_LEAD_MINUTES, isProposalLapsed, minutesToStart } from "../../../shared/lib/providerRules.js";

/**
 * A provider's proposal on a CONFIRMED booking (owner's rules of 2026-10-22): another time (`proposal_date` /
 * `proposal_time`) or, when a team member leaves, another artist (`proposal_staff`). The booking itself is not touched:
 * its original time and artist stay valid until the client accepts. A proposal ends when the client accepts or cancels,
 * the provider withdraws or the booking changes, or after 6 hours / 2 hours before the booking (sweepLapsedProposals).
 *
 * Every state change here runs on the booking's own row lock (SELECT ... FOR UPDATE), so «accept» and «cancel» at the
 * same moment, a proposal on a booking just cancelled, and an answer to a proposal that was just replaced all end in
 * exactly one consistent result.
 */

export const SALON_CONFIRMED = ["تایید شده", "تازه"];
export const ARTIST_CONFIRMED = ["تایید شده", "تایید"];

const fail = (error, message, extra = {}) => ({ ok: false, error, message, ...extra });
const MESSAGES = {
  missing: "رزرو پیدا نشد.",
  not_confirmed: "این نوبت دیگر تأییدشده نیست؛ فهرست را تازه کن.",
  no_account: "این مشتری حساب فرفرو ندارد؛ با او تماس بگیر.",
  too_late: "نوبت کمتر از ۲ ساعت دیگر است و دیگر جا برای پیشنهاد نیست. با مشتری تماس بگیر.",
  slot: "این ساعت جای خالیِ داخل ساعت کاری نیست؛ یکی از ساعت‌های فهرست را انتخاب کن.",
  same: "این همان ساعت فعلی نوبت است.",
  staff: "این آرتیست در این ساعت آزاد نیست یا عضو تیم نیست.",
  changed: "این نوبت همین الان تغییر کرد؛ فهرست را تازه کردیم."
};
const refuse = (code, extra) => fail(code, MESSAGES[code] || "انجام نشد.", extra);

function leadProblem(bookingDate, time) {
  const minutes = minutesToStart(bookingDate, time);
  return minutes === null || minutes < PROPOSAL_MIN_LEAD_MINUTES + 1;
}

/** The salon proposes another time for one of its confirmed bookings. */
export async function proposeSalonTime({ salonUserId, id, date = "", time = "" }) {
  await salons.ensureBookingColumns();
  const db = await getDb();
  const current = await get(db, "SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2", [Number(id), Number(salonUserId)]);
  if (!current) return refuse("missing");
  if (!SALON_CONFIRMED.includes(current.status)) return refuse("not_confirmed");
  if (!current.client_user_id) return refuse("no_account", { phone: current.phone || "" });
  if (leadProblem(current.booking_date, current.time)) return refuse("too_late", { phone: current.phone || "" });
  const dateKey = resolveRollingPersianDateKey(date || current.booking_date);
  const clock = normalizeBookingTimeLabel(time || current.time);
  if (dateKey === current.booking_date && clock === normalizeBookingTimeLabel(current.time || "")) return refuse("same");
  if (isSlotInPast(dateKey, clock)) return refuse("slot");
  // The proposed time must itself be a free slot inside working hours: the same list the «تغییر ساعت» picker shows,
  // without the "stay longer" times.
  const options = await bookingMoveOptions(Number(salonUserId), Number(id), dateKey);
  const option = options.ok && !options.closed ? options.times.find((item) => item.time === clock && !(item.overtimeMinutes > 0)) : null;
  if (!option) return refuse("slot");
  return withTransaction(null, async (tx) => {
    const locked = await get(tx, "SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2 FOR UPDATE", [Number(id), Number(salonUserId)]);
    if (!locked) return refuse("missing");
    if (!SALON_CONFIRMED.includes(locked.status)) return refuse("not_confirmed");
    if (locked.booking_date !== current.booking_date || normalizeBookingTimeLabel(locked.time || "") !== normalizeBookingTimeLabel(current.time || "") || locked.staff !== current.staff) return refuse("changed");
    await run(tx, `
      UPDATE salon_bookings SET proposal_date = $1, proposal_time = $2, proposal_staff = '', proposal_from = '', proposal_at = NOW() WHERE id = $3
    `, [dateKey, clock, Number(id)]);
    return { ok: true, booking: await get(tx, "SELECT * FROM salon_bookings WHERE id = $1", [Number(id)]), kind: "salon", toDate: dateKey, toTime: clock };
  });
}

/** Which of a booking's staff names belong to the given staff rows (a single booking, or the parts of a visit). */
function namesInBooking(booking, names) {
  if (isMultiPartBooking(booking)) return parseBookingParts(booking.parts).filter((part) => names.has(String(part.staff || "").trim())).map((part) => part.staff);
  return names.has(String(booking.staff || "").trim()) ? [String(booking.staff).trim()] : [];
}

/**
 * Proposes another artist for the parts of a confirmed booking held by `fromNames` (the team member who is leaving).
 * Who may ask: the salon, or the leaving artist for a booking of theirs (`actorArtistId`). The new artist must be a
 * member of the team and free at every one of those parts.
 */
export async function proposeSalonHandover({ salonUserId, id, toStaff, fromNames = [], actorArtistId = null }) {
  await salons.ensureBookingColumns();
  const db = await getDb();
  const current = await get(db, "SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2", [Number(id), Number(salonUserId)]);
  if (!current) return refuse("missing");
  if (!SALON_CONFIRMED.includes(current.status)) return refuse("not_confirmed");
  if (!current.client_user_id) return refuse("no_account", { phone: current.phone || "" });
  const names = new Set(fromNames.map((name) => String(name || "").trim()).filter(Boolean));
  const mine = namesInBooking(current, names);
  if (!mine.length) return refuse("missing");
  if (actorArtistId) {
    const own = await all(db, "SELECT name FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2", [Number(salonUserId), Number(actorArtistId)]);
    if (!mine.every((name) => own.some((row) => String(row.name || "").trim() === name))) return refuse("missing");
  }
  const target = String(toStaff || "").trim();
  if (!target || names.has(target)) return refuse("staff");
  const options = await salons.listBookingStaffOptions(Number(id), Number(salonUserId));
  if (!options) return refuse("missing");
  const wanted = options.parts.filter((part) => names.has(String(part.staff || "").trim()));
  const fits = wanted.length > 0 && wanted.every((part) => part.options.some((option) => option.name === target && option.free && !option.away));
  if (!fits) return refuse("staff");
  return withTransaction(null, async (tx) => {
    const locked = await get(tx, "SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2 FOR UPDATE", [Number(id), Number(salonUserId)]);
    if (!locked) return refuse("missing");
    if (!SALON_CONFIRMED.includes(locked.status)) return refuse("not_confirmed");
    if (locked.booking_date !== current.booking_date || normalizeBookingTimeLabel(locked.time || "") !== normalizeBookingTimeLabel(current.time || "") || locked.staff !== current.staff || locked.parts !== current.parts) return refuse("changed");
    await run(tx, "UPDATE salon_bookings SET proposal_date = '', proposal_time = '', proposal_staff = $1, proposal_from = $2, proposal_at = NOW() WHERE id = $3", [target, mine.join("\n"), Number(id)]);
    return { ok: true, booking: await get(tx, "SELECT * FROM salon_bookings WHERE id = $1", [Number(id)]), kind: "salon", toStaff: target, fromStaff: mine[0] };
  });
}

/** An independent artist proposes another time for a confirmed direct booking. */
export async function proposeArtistTime({ artistUserId, id, date = "", time = "" }) {
  await salons.ensureBookingColumns();
  const db = await getDb();
  const current = await get(db, "SELECT * FROM artist_bookings WHERE id = $1 AND artist_user_id = $2 AND source_salon_user_id IS NULL", [Number(id), Number(artistUserId)]);
  if (!current) return refuse("missing");
  if (!ARTIST_CONFIRMED.includes(current.status)) return refuse("not_confirmed");
  if (!current.client_user_id) return refuse("no_account", { phone: current.client_phone || "" });
  if (leadProblem(current.booking_date, current.time)) return refuse("too_late", { phone: current.client_phone || "" });
  const dateKey = resolveRollingPersianDateKey(date || current.booking_date);
  const clock = normalizeBookingTimeLabel(time || current.time);
  if (dateKey === current.booking_date && clock === normalizeBookingTimeLabel(current.time || "")) return refuse("same");
  if (isSlotInPast(dateKey, clock)) return refuse("slot");
  const minutes = Math.max(15, Number(current.duration_minutes) || 60);
  if (artistSlotProblem({ hours: await artists.listArtistHours(Number(artistUserId)), bookingDateKey: dateKey, time: clock, durationMinutes: minutes })) return refuse("slot");
  if (await artists.isArtistSlotBlocked(Number(artistUserId), dateKey, clock, minutes, Number(id))) return refuse("slot");
  return withTransaction(null, async (tx) => {
    const locked = await get(tx, "SELECT * FROM artist_bookings WHERE id = $1 AND artist_user_id = $2 FOR UPDATE", [Number(id), Number(artistUserId)]);
    if (!locked) return refuse("missing");
    if (!ARTIST_CONFIRMED.includes(locked.status)) return refuse("not_confirmed");
    if (locked.booking_date !== current.booking_date || normalizeBookingTimeLabel(locked.time || "") !== normalizeBookingTimeLabel(current.time || "")) return refuse("changed");
    await run(tx, "UPDATE artist_bookings SET proposal_date = $1, proposal_time = $2, proposal_at = NOW() WHERE id = $3", [dateKey, clock, Number(id)]);
    return { ok: true, booking: await get(tx, "SELECT * FROM artist_bookings WHERE id = $1", [Number(id)]), kind: "artist", toDate: dateKey, toTime: clock };
  });
}

/** The provider takes a proposal back (the original stays as it was). */
export async function withdrawProposal({ kind, id, providerUserId }) {
  await salons.ensureBookingColumns();
  const table = kind === "artist" ? "artist_bookings" : "salon_bookings";
  const owner = kind === "artist" ? "artist_user_id" : "salon_user_id";
  return withTransaction(null, async (tx) => {
    const locked = await get(tx, `SELECT * FROM ${table} WHERE id = $1 AND ${owner} = $2 FOR UPDATE`, [Number(id), Number(providerUserId)]);
    if (!locked) return refuse("missing");
    if (!locked.proposal_at) return { ok: true, booking: locked, nothing: true };
    await clearProposal(tx, table, Number(id));
    return { ok: true, booking: await get(tx, `SELECT * FROM ${table} WHERE id = $1`, [Number(id)]) };
  });
}

const clearProposal = (db, table, id) => run(db, `
  UPDATE ${table} SET proposal_date = '', proposal_time = '', ${table === "salon_bookings" ? "proposal_staff = '', proposal_from = ''," : ""} proposal_at = NULL WHERE id = $1
`, [id]);

/**
 * The client says «قبول می‌کنم»: the booking moves to the proposed time (and/or artist) in one transaction with its
 * artist-calendar copies. Refused (and the original left exactly as it was) when the proposal was withdrawn or replaced
 * (`stale`), ran out (`expired`), the booking is no longer confirmed (`inactive`), or the time/artist is no longer free
 * or inside working hours (`unavailable`).
 */
export async function acceptProposal({ kind, id, client }) {
  await salons.ensureBookingColumns();
  if (kind === "artist") return acceptArtistProposal({ id, client });
  const db = await getDb();
  const match = clientBookingMatch(client, { alias: "b", startAt: 2 });
  const current = match.sql ? await get(db, `SELECT b.* FROM salon_bookings b WHERE b.id = $1 AND ${match.sql}`, [Number(id), ...match.params]) : null;
  if (!current) return fail("missing", MESSAGES.missing);
  if (!SALON_CONFIRMED.includes(current.status)) return fail("inactive", "این نوبت دیگر فعال نیست.");
  if (!current.proposal_at) return fail("no_proposal", "پیشنهادی برای این نوبت نمانده است.");
  if (isProposalLapsed(current)) {
    const closed = await closeLapsedSalonProposal(current.id);
    return fail("expired", "مهلت جواب به این پیشنهاد تمام شده؛ نوبت قبلی‌ات سر جایش است.", { code: "PROPOSAL_EXPIRED", lapsed: closed ? lapsedInfo("salon", closed) : null });
  }
  if (!current.salon_user_id) return fail("inactive", "این نوبت دیگر فعال نیست.");
  const data = {
    status: current.status,
    ...(current.proposal_time ? { bookingDate: current.proposal_date || current.booking_date, time: current.proposal_time } : {}),
    ...(current.proposal_staff
      ? (isMultiPartBooking(current)
        ? { parts: handoverParts(current) }
        : { staff: current.proposal_staff })
      : {})
  };
  const result = await salons.patchSalonBookingWithArtistSync(Number(id), current.salon_user_id, data, {
    clientAnswer: true,
    acceptProposal: { at: new Date(current.proposal_at).getTime() }
  });
  if (result.ok) return { ok: true, booking: result.booking, salonUserId: current.salon_user_id, before: current };
  if (result.error === "proposal_lapsed") {
    const closed = await closeLapsedSalonProposal(current.id);
    return fail("expired", "مهلت جواب به این پیشنهاد تمام شده؛ نوبت قبلی‌ات سر جایش است.", { code: "PROPOSAL_EXPIRED", lapsed: closed ? lapsedInfo("salon", closed) : null });
  }
  if (result.error === "inactive" || result.error === "expired") return fail("inactive", "این نوبت دیگر فعال نیست.");
  if (result.error === "stale") return fail("stale", "پیشنهاد همین الان عوض یا پس گرفته شد؛ صفحه را تازه کن.", { code: "PROPOSAL_CHANGED" });
  // The time or artist is no longer free: the proposal can't be honoured, the original stays, the provider is told.
  await run(db, "UPDATE salon_bookings SET proposal_date = '', proposal_time = '', proposal_staff = '', proposal_from = '', proposal_at = NULL WHERE id = $1 AND proposal_at = $2", [Number(id), current.proposal_at]);
  return fail("unavailable", "این ساعت یا آرتیست دیگر آزاد نیست؛ نوبت قبلی‌ات همان‌طور که بود سر جایش است.", { code: "PROPOSAL_UNAVAILABLE", salonUserId: current.salon_user_id, before: current });
}

/** The parts of a visit with the leaving artist's parts (and any part nobody holds any more) given to the proposed one. */
function handoverParts(current) {
  const from = new Set(String(current.proposal_from || "").split("\n").map((name) => name.trim()).filter(Boolean));
  return parseBookingParts(current.parts).map((part) => (!part.staff || from.has(String(part.staff).trim()) ? { ...part, staff: current.proposal_staff } : part));
}

async function acceptArtistProposal({ id, client }) {
  const db = await getDb();
  const match = clientBookingMatch(client, { alias: "b", startAt: 2 });
  const current = match.sql ? await get(db, `SELECT b.* FROM artist_bookings b WHERE b.id = $1 AND b.source_salon_user_id IS NULL AND ${match.sql}`, [Number(id), ...match.params]) : null;
  if (!current) return fail("missing", MESSAGES.missing);
  if (!ARTIST_CONFIRMED.includes(current.status)) return fail("inactive", "این نوبت دیگر فعال نیست.");
  if (!current.proposal_at) return fail("no_proposal", "پیشنهادی برای این نوبت نمانده است.");
  if (isProposalLapsed(current)) {
    const closed = await closeLapsedArtistProposal(current.id);
    return fail("expired", "مهلت جواب به این پیشنهاد تمام شده؛ نوبت قبلی‌ات سر جایش است.", { code: "PROPOSAL_EXPIRED", lapsed: closed ? lapsedInfo("artist", closed) : null });
  }
  if (!current.artist_user_id) return fail("inactive", "این نوبت دیگر فعال نیست.");
  const artistUserId = Number(current.artist_user_id);
  const minutes = Math.max(15, Number(current.duration_minutes) || 60);
  const hours = await artists.listArtistHours(artistUserId);
  return withTransaction(null, async (tx) => {
    const days = [...new Set([current.booking_date, current.proposal_date || current.booking_date])].sort();
    for (const day of days) await lockArtistDays(tx, [artistUserId], day);
    const locked = await get(tx, "SELECT * FROM artist_bookings WHERE id = $1 FOR UPDATE", [Number(id)]);
    if (!locked || !ARTIST_CONFIRMED.includes(locked.status)) return fail("inactive", "این نوبت دیگر فعال نیست.");
    if (!locked.proposal_at || new Date(locked.proposal_at).getTime() !== new Date(current.proposal_at).getTime()) return fail("stale", "پیشنهاد همین الان عوض یا پس گرفته شد؛ صفحه را تازه کن.", { code: "PROPOSAL_CHANGED" });
    if (isProposalLapsed(locked)) {
      await clearProposal(tx, "artist_bookings", locked.id);
      return fail("expired", "مهلت جواب به این پیشنهاد تمام شده؛ نوبت قبلی‌ات سر جایش است.", { code: "PROPOSAL_EXPIRED", lapsed: lapsedInfo("artist", locked) });
    }
    const toDate = locked.proposal_date || locked.booking_date;
    const toTime = locked.proposal_time || locked.time;
    const problem = isSlotInPast(toDate, toTime)
      || artistSlotProblem({ hours, bookingDateKey: toDate, time: toTime, durationMinutes: minutes })
      || await artists.isArtistSlotBlocked(artistUserId, toDate, toTime, minutes, locked.id, tx);
    if (problem) {
      await clearProposal(tx, "artist_bookings", locked.id);
      return fail("unavailable", "این ساعت دیگر آزاد نیست؛ نوبت قبلی‌ات همان‌طور که بود سر جایش است.", { code: "PROPOSAL_UNAVAILABLE", artistUserId, before: locked });
    }
    await run(tx, `
      UPDATE artist_bookings SET booking_date = $1, time = $2, proposal_date = '', proposal_time = '', proposal_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $3
    `, [toDate, toTime, locked.id]);
    return { ok: true, booking: await get(tx, "SELECT * FROM artist_bookings WHERE id = $1", [locked.id]), artistUserId, before: locked };
  });
}

/** What the caller needs to tell the provider «با مشتری تماس بگیر» when this call is the one that closed a lapsed proposal. */
function lapsedInfo(kind, row) {
  return {
    providerUserId: (kind === "salon" ? row.salon_user_id : row.artist_user_id) || null,
    clientUserId: row.client_user_id || null,
    booking: row,
    clientName: (kind === "salon" ? row.client : row.client_name) || ""
  };
}

async function closeLapsedSalonProposal(id) {
  const db = await getDb();
  return get(db, `
    UPDATE salon_bookings SET proposal_date = '', proposal_time = '', proposal_staff = '', proposal_from = '', proposal_at = NULL
    WHERE id = $1 AND proposal_at IS NOT NULL RETURNING *
  `, [Number(id)]);
}
async function closeLapsedArtistProposal(id) {
  const db = await getDb();
  return get(db, `
    UPDATE artist_bookings SET proposal_date = '', proposal_time = '', proposal_at = NULL
    WHERE id = $1 AND proposal_at IS NOT NULL RETURNING *
  `, [Number(id)]);
}

/**
 * The sweep's half: every proposal past its deadline (6 hours, or 2 hours before the booking) is closed, the original
 * stays, and the caller tells the provider to call the client. Returns the closed ones as
 * [{ kind, booking, providerUserId, clientUserId }]; each is closed by exactly one caller (the UPDATE ... WHERE
 * proposal_at IS NOT NULL ... RETURNING decides).
 */
export async function sweepLapsedProposals(now = new Date()) {
  const db = await getDb();
  const closed = [];
  for (const [kind, table, providerColumn] of [["salon", "salon_bookings", "salon_user_id"], ["artist", "artist_bookings", "artist_user_id"]]) {
    const rows = await all(db, `SELECT * FROM ${table} WHERE proposal_at IS NOT NULL`);
    for (const row of rows) {
      const dead = !(kind === "salon" ? SALON_CONFIRMED : ARTIST_CONFIRMED).includes(row.status) || isProposalLapsed(row, now);
      if (!dead) continue;
      const done = kind === "salon" ? await closeLapsedSalonProposal(row.id) : await closeLapsedArtistProposal(row.id);
      if (done) closed.push({ kind, booking: row, providerUserId: row[providerColumn] || null, clientUserId: row.client_user_id || null });
    }
  }
  return closed;
}

