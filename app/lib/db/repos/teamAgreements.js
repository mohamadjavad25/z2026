import { all, get, getDb, run, withTransaction } from "../connection.js";
import { bookingStartMs } from "../../../shared/lib/reminderTiming.js";
import { dateKeyAfter } from "../../../shared/lib/artistPlace.js";
import { timeLabelToMinutes } from "../../../shared/lib/time.js";
import { toLatinDigits } from "../../../shared/lib/digits.js";

/**
 * Leave, terms and the ledger between a salon and a team artist (owner's decision 2026-10-28, docs/DECISIONS.md;
 * tables in migration 061). Every function takes the two ids of ONE pair and the caller has already proven who the
 * caller is and that the pair is a team (assertPair); nothing here reads a third party's numbers.
 */

/** The ledger starts with the day it shipped: older bookings were agreed on other terms and are not written. */
export const LEDGER_FROM = "1405-08-06";
/** A change of terms starts at least this many days after it is proposed (owner's answer 3). */
export const TERMS_LEAD_DAYS = 7;
/** A leave is for at most this many days (the artist makes a new one after). */
export const LEAVE_MAX_DAYS = 60;

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const plainDay = (value) => String(value || "").replace(/[‌\s]/g, "");

const CONFIRMED = ["تایید شده", "تایید"];

/** «۶۰»、«60»、«۶۰ درصد» → 60; anything else (e.g. «قابل مذاکره») → null. */
export function parsePercent(text) {
  const match = toLatinDigits(String(text ?? "")).match(/^\s*(\d{1,3})\s*(?:%|٪|درصد)?\s*$/);
  const value = match ? Number(match[1]) : null;
  return value !== null && value <= 100 ? value : null;
}

/** «۴۵۰٬۰۰۰» / «450,000» / «۴۵۰۰۰۰ تومان» → 450000; "" or text → 0. */
export function parseAmount(text) {
  const digits = toLatinDigits(String(text ?? "")).replace(/[,٬\s]/g, "").match(/^\d{1,12}/);
  return digits ? Number(digits[0]) : 0;
}

const validKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
const validTime = (value) => /^[0-9۰-۹]{1,2}:[0-9۰-۹]{2}$/.test(String(value || "").trim());

/** Proves the pair is a team (the artist is a member of the salon); → the staff row or null. */
export async function assertPair(salonUserId, artistUserId, runner = null) {
  const db = runner || (await getDb());
  return get(db, "SELECT * FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 AND NOT is_owner LIMIT 1", [Number(salonUserId), Number(artistUserId)]);
}

/* ───────────── leave ───────────── */

/** An artist's upcoming leaves (today on), soonest first. */
export async function listLeaves(artistUserId, runner = null) {
  const db = runner || (await getDb());
  const rows = await all(db, "SELECT * FROM artist_leaves WHERE artist_user_id = $1 AND cancelled_at IS NULL AND date_to >= $2 ORDER BY date_from, id", [Number(artistUserId), dateKeyAfter(0)]);
  return rows.map(leaveView);
}

/** Upcoming leaves of several artists at once (the salon's team list): Map artistId → [view]. */
export async function listLeavesFor(artistIds, runner = null) {
  const map = new Map();
  if (!artistIds.length) return map;
  const db = runner || (await getDb());
  const rows = await all(db, "SELECT * FROM artist_leaves WHERE artist_user_id = ANY($1::int[]) AND cancelled_at IS NULL AND date_to >= $2 ORDER BY date_from, id", [artistIds, dateKeyAfter(0)]);
  for (const row of rows) {
    const list = map.get(Number(row.artist_user_id)) || [];
    list.push(leaveView(row));
    map.set(Number(row.artist_user_id), list);
  }
  return map;
}

function leaveView(row) {
  return { id: row.id, from: row.date_from, to: row.date_to, start: row.start_time || "", end: row.end_time || "", note: row.note || "" };
}

/** Checks a leave request; → { ok: true, value } or { ok: false, error }. Dates are Persian date keys. */
export function checkLeave(input, now = new Date()) {
  const from = String(input.from || "");
  const to = String(input.to || from);
  const start = String(input.start || "").trim();
  const end = String(input.end || "").trim();
  const today = dateKeyAfter(0, now);
  if (!validKey(from) || !validKey(to)) return { ok: false, error: "روز مرخصی رو انتخاب کن." };
  if (from < today) return { ok: false, error: "مرخصی برای روزی که گذشته نمی‌شه." };
  if (to < from) return { ok: false, error: "روز آخر نمی‌تونه قبل از روز اول باشه." };
  if (to > dateKeyAfter(LEAVE_MAX_DAYS, now)) return { ok: false, error: "مرخصی بیشتر از ۶۰ روز یه‌جا نمی‌شه؛ بعدش یکی دیگه بذار." };
  if ((start && !end) || (!start && end)) return { ok: false, error: "ساعت شروع و پایان رو هر دو بزن، یا «همهٔ روز» رو بذار." };
  if (start) {
    if (!validTime(start) || !validTime(end)) return { ok: false, error: "ساعت‌ها درست نیست." };
    if (timeLabelToMinutes(end) <= timeLabelToMinutes(start)) return { ok: false, error: "ساعت پایان باید بعد از ساعت شروع باشه." };
  }
  return { ok: true, value: { from, to, start, end, note: String(input.note || "").trim().slice(0, 120) } };
}

export async function addLeave(artistUserId, value, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, `
    INSERT INTO artist_leaves (artist_user_id, date_from, date_to, start_time, end_time, note)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [Number(artistUserId), value.from, value.to, value.start, value.end, value.note]);
  return leaveView(row);
}

export async function cancelLeave(artistUserId, id) {
  const db = await getDb();
  const row = await get(db, "UPDATE artist_leaves SET cancelled_at = CURRENT_TIMESTAMP WHERE id = $1 AND artist_user_id = $2 AND cancelled_at IS NULL RETURNING *", [Number(id), Number(artistUserId)]);
  return row ? leaveView(row) : null;
}

/** The salons whose team an artist is on (to tell them about a leave): [{ salonUserId }]. */
export async function salonsOfArtist(artistUserId) {
  const db = await getDb();
  return all(db, "SELECT DISTINCT salon_user_id FROM salon_staff WHERE artist_user_id = $1 AND NOT is_owner", [Number(artistUserId)]);
}

/* ───────────── terms ───────────── */

/**
 * The terms in force for a pair on `dateKey`: the newest agreed row whose day has come, else the invite's old text terms
 * (`legacy: true`, the percent only when it is a plain number). → { days, from, to, share, ownShare, effectiveFrom, legacy }
 */
export async function currentTerms(salonUserId, artistUserId, dateKey = dateKeyAfter(0), runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, `
    SELECT * FROM team_terms WHERE salon_user_id = $1 AND artist_user_id = $2 AND effective_from <= $3
    ORDER BY effective_from DESC, id DESC LIMIT 1
  `, [Number(salonUserId), Number(artistUserId), dateKey]);
  if (row) return { days: row.days, from: row.from_time, to: row.to_time, share: row.share_percent, ownShare: row.own_share_percent, effectiveFrom: row.effective_from, legacy: false };
  const old = await get(db, `
    SELECT COALESCE(i.days, c.days, '') AS days, COALESCE(i.from_time, c.from_time, '') AS from_time, COALESCE(i.to_time, c.to_time, '') AS to_time,
           COALESCE(i.share_percent, c.share_percent, '') AS share_percent
    FROM (SELECT 1) one
    LEFT JOIN salon_artist_invites i ON i.salon_user_id = $1 AND i.artist_user_id = $2 AND i.status = 'تایید شد'
    LEFT JOIN LATERAL (SELECT * FROM artist_collabs WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'تایید شد' ORDER BY id DESC LIMIT 1) c ON TRUE
  `, [Number(salonUserId), Number(artistUserId)]);
  return { days: old?.days || "", from: old?.from_time || "", to: old?.to_time || "", share: parsePercent(old?.share_percent), ownShare: null, effectiveFrom: "", legacy: true };
}

/** The terms that start later than today and are already agreed (shown as «از … اجرا می‌شه»); null when none. */
export async function upcomingTerms(salonUserId, artistUserId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, "SELECT * FROM team_terms WHERE salon_user_id = $1 AND artist_user_id = $2 AND effective_from > $3 ORDER BY effective_from, id LIMIT 1", [Number(salonUserId), Number(artistUserId), dateKeyAfter(0)]);
  return row ? { days: row.days, from: row.from_time, to: row.to_time, share: row.share_percent, ownShare: row.own_share_percent, effectiveFrom: row.effective_from } : null;
}

const proposalView = (row) => row && {
  id: row.id, by: row.proposed_by, days: row.days, from: row.from_time, to: row.to_time, share: row.share_percent, ownShare: row.own_share_percent,
  note: row.note || "", effectiveFrom: row.effective_from, status: row.status, createdAt: row.created_at
};

export async function pendingProposal(salonUserId, artistUserId, runner = null) {
  const db = runner || (await getDb());
  return proposalView(await get(db, "SELECT * FROM team_term_proposals WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'pending' ORDER BY id DESC LIMIT 1", [Number(salonUserId), Number(artistUserId)]));
}

/** Everything the terms screen needs for one pair. */
export async function termsOverview(salonUserId, artistUserId) {
  const [current, upcoming, pending] = await Promise.all([
    currentTerms(salonUserId, artistUserId),
    upcomingTerms(salonUserId, artistUserId),
    pendingProposal(salonUserId, artistUserId)
  ]);
  return { current, upcoming, pending };
}

/** Days and hours must be real, and share a number; the hours must sit inside the salon's own open hours that day. */
export async function checkTerms(salonUserId, input, runner = null) {
  const db = runner || (await getDb());
  const days = WEEKDAYS.filter((day) => String(input.days || "").split(/[،,]/).map(plainDay).includes(plainDay(day)));
  const from = String(input.from || "").trim();
  const to = String(input.to || "").trim();
  if (!days.length) return { ok: false, error: "دست‌کم یه روز انتخاب کن." };
  if (!validTime(from) || !validTime(to) || timeLabelToMinutes(to) <= timeLabelToMinutes(from)) return { ok: false, error: "ساعت پایان باید بعد از ساعت شروع باشه." };
  const share = input.share === "" || input.share === null || input.share === undefined ? null : Number(toLatinDigits(String(input.share)));
  const own = input.ownShare === "" || input.ownShare === null || input.ownShare === undefined ? null : Number(toLatinDigits(String(input.ownShare)));
  for (const value of [share, own]) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) return { ok: false, error: "درصد باید بین ۰ و ۱۰۰ باشه." };
  }
  if (share === null) return { ok: false, error: "درصد سهم آرتیست رو مشخص کن." };
  const hours = await all(db, "SELECT day, open_time, close_time, active FROM salon_hours WHERE salon_user_id = $1", [Number(salonUserId)]);
  if (hours.length) {
    for (const day of days) {
      const row = hours.find((item) => plainDay(item.day) === plainDay(day));
      if (!row || !row.active) return { ok: false, error: `سالن ${day} بسته‌ست.` };
      if (timeLabelToMinutes(from) < timeLabelToMinutes(row.open_time) || timeLabelToMinutes(to) > timeLabelToMinutes(row.close_time)) {
        return { ok: false, error: `سالن ${day} فقط از ${row.open_time} تا ${row.close_time} بازه؛ ساعت رو توی همین بازه بذار.` };
      }
    }
  }
  return { ok: true, value: { days: days.join("، "), from, to, share, ownShare: own, note: String(input.note || "").trim().slice(0, 120) } };
}

/** `by` proposes new terms; the previous waiting proposal (either side's) is superseded. The start day is at least TERMS_LEAD_DAYS away. */
export async function propose({ salonUserId, artistUserId, by, value, effectiveFrom }) {
  const earliest = dateKeyAfter(TERMS_LEAD_DAYS);
  const start = validKey(effectiveFrom) && effectiveFrom >= earliest ? effectiveFrom : earliest;
  return withTransaction(null, async (db) => {
    await run(db, "UPDATE team_term_proposals SET status = 'superseded', answered_at = CURRENT_TIMESTAMP WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'pending'", [Number(salonUserId), Number(artistUserId)]);
    const row = await get(db, `
      INSERT INTO team_term_proposals (salon_user_id, artist_user_id, proposed_by, days, from_time, to_time, share_percent, own_share_percent, note, effective_from)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [Number(salonUserId), Number(artistUserId), by, value.days, value.from, value.to, value.share, value.ownShare, value.note, start]);
    return proposalView(row);
  });
}

/** The side that did not propose says yes or no; the proposer may take it back. → { ok, proposal } or { ok: false, code }. */
export async function answerProposal({ salonUserId, artistUserId, id, side, action }) {
  return withTransaction(null, async (db) => {
    const row = await get(db, "SELECT * FROM team_term_proposals WHERE id = $1 AND salon_user_id = $2 AND artist_user_id = $3 FOR UPDATE", [Number(id), Number(salonUserId), Number(artistUserId)]);
    if (!row) return { ok: false, code: "NOT_FOUND" };
    if (row.status !== "pending") return { ok: false, code: "CLOSED" };
    const mine = row.proposed_by === side;
    if (action === "cancel") {
      if (!mine) return { ok: false, code: "FORBIDDEN" };
      await run(db, "UPDATE team_term_proposals SET status = 'cancelled', answered_at = CURRENT_TIMESTAMP WHERE id = $1", [row.id]);
      return { ok: true, proposal: proposalView({ ...row, status: "cancelled" }) };
    }
    if (mine) return { ok: false, code: "FORBIDDEN" };
    if (action === "reject") {
      await run(db, "UPDATE team_term_proposals SET status = 'rejected', answered_at = CURRENT_TIMESTAMP WHERE id = $1", [row.id]);
      return { ok: true, proposal: proposalView({ ...row, status: "rejected" }) };
    }
    // Accepting late never rewrites the past: the terms start on the proposed day, or tomorrow when that day has passed.
    const start = row.effective_from > dateKeyAfter(0) ? row.effective_from : dateKeyAfter(1);
    await run(db, `
      INSERT INTO team_terms (salon_user_id, artist_user_id, effective_from, days, from_time, to_time, share_percent, own_share_percent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [row.salon_user_id, row.artist_user_id, start, row.days, row.from_time, row.to_time, row.share_percent, row.own_share_percent]);
    await run(db, "UPDATE team_term_proposals SET status = 'accepted', effective_from = $2, answered_at = CURRENT_TIMESTAMP WHERE id = $1", [row.id, start]);
    // Work already done while no percent was agreed (an old «قابل مذاکره» invite) takes the first percent they agree on, so
    // it can be settled; lines that already have a percent are never touched.
    await run(db, `
      UPDATE team_ledger_lines SET share_percent = CASE WHEN own_client THEN COALESCE($3::int, $4::int) ELSE $4::int END
      WHERE salon_user_id = $1 AND artist_user_id = $2 AND share_percent IS NULL AND settlement_id IS NULL
    `, [row.salon_user_id, row.artist_user_id, row.own_share_percent, row.share_percent]);
    return { ok: true, proposal: proposalView({ ...row, status: "accepted", effective_from: start }) };
  });
}

/**
 * Do the agreed terms (when the pair has any, not the invite's old text) let this artist take a visit at the salon? Only
 * agreed rows limit bookings, so nothing that worked before changes for a pair that never used them.
 */
export function termsAllow(terms, dateKey, weekdayName, startMinute, endMinute) {
  if (!terms || terms.legacy || !terms.days) return true;
  if (!terms.days.split(/[،,]/).map(plainDay).includes(plainDay(weekdayName))) return false;
  return startMinute >= timeLabelToMinutes(terms.from) && endMinute <= timeLabelToMinutes(terms.to);
}

/* ───────────── ledger ───────────── */

/** Price of a booking's service(s): own clients use the artist's own list, the salon's clients the salon's. */
async function priceOf(db, { salonUserId, artistUserId, service, own }) {
  const names = String(service || "").split("+").map((item) => item.trim()).filter(Boolean);
  if (!names.length) return 0;
  const rows = own
    ? await all(db, "SELECT name, price FROM artist_services WHERE user_id = $1 AND name = ANY($2)", [Number(artistUserId), names])
    : await all(db, "SELECT name, price FROM salon_services WHERE salon_user_id = $1 AND name = ANY($2)", [Number(salonUserId), names]);
  return names.reduce((sum, name) => sum + parseAmount(rows.find((row) => row.name === name)?.price), 0);
}

/**
 * Writes the lines of the bookings that finished since the last look (confirmed, not marked «نیومد», their end passed),
 * from LEDGER_FROM on. One line per artist calendar row (unique), so reading twice never doubles anything.
 */
export async function materializeLedger(salonUserId, artistUserId, now = new Date()) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT b.* FROM artist_bookings b
    WHERE b.artist_user_id = $2 AND b.status = ANY($3) AND b.no_show_at IS NULL AND b.booking_date >= $4
      AND ((b.source_salon_user_id = $1 AND b.salon_booking_id IS NOT NULL)
        OR (b.place_salon_user_id = $1 AND b.salon_booking_id IS NULL AND b.source_salon_user_id IS NULL))
      AND NOT EXISTS (SELECT 1 FROM team_ledger_lines l WHERE l.artist_booking_id = b.id)
    ORDER BY b.booking_date, b.time
  `, [Number(salonUserId), Number(artistUserId), CONFIRMED, LEDGER_FROM]);
  for (const row of rows) {
    const start = bookingStartMs(row.booking_date, row.time, now);
    if (start === null || start + Math.max(15, Number(row.duration_minutes) || 60) * 60000 > now.getTime()) continue;
    const own = !row.salon_booking_id;
    const terms = await currentTerms(salonUserId, artistUserId, row.booking_date, db);
    let share = own ? (terms.ownShare ?? terms.share) : terms.share;
    if (share === null) {
      // No percent was in force that day (an old text-only invite): the first percent they agreed on covers it.
      const first = await get(db, "SELECT share_percent, own_share_percent FROM team_terms WHERE salon_user_id = $1 AND artist_user_id = $2 ORDER BY effective_from, id LIMIT 1", [Number(salonUserId), Number(artistUserId)]);
      if (first) share = own ? (first.own_share_percent ?? first.share_percent) : first.share_percent;
    }
    const amount = await priceOf(db, { salonUserId, artistUserId, service: row.service, own });
    await run(db, `
      INSERT INTO team_ledger_lines (salon_user_id, artist_user_id, artist_booking_id, booking_date, service, client_first, own_client, original_amount, amount, share_percent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9) ON CONFLICT (artist_booking_id) DO NOTHING
    `, [Number(salonUserId), Number(artistUserId), row.id, row.booking_date, row.service || "", String(row.client_name || "").trim().split(/\s+/)[0] || "", own, amount, share]);
  }
}

const artistPart = (line) => (line.share_percent === null ? 0 : Math.round((Number(line.amount) * line.share_percent) / 100));

/**
 * The net of a set of lines. The salon collects its own clients' money and owes the artist their share; the artist
 * collects their own clients' money at the salon and owes the salon its part. `net` > 0: the salon pays the artist;
 * `net` < 0: the artist pays the salon.
 */
export function ledgerTotals(lines) {
  let net = 0;
  let amount = 0;
  let artistShare = 0;
  let unknown = 0;
  for (const line of lines) {
    if (line.share_percent === null) { unknown += 1; continue; }
    const mine = artistPart(line);
    amount += Number(line.amount);
    artistShare += mine;
    net += line.own_client ? -(Number(line.amount) - mine) : mine;
  }
  return { net, amount, artistShare, salonShare: amount - artistShare, unknown };
}

const lineView = (line) => ({
  id: line.id, date: line.booking_date, service: line.service, client: line.client_first, own: Boolean(line.own_client),
  amount: Number(line.amount), originalAmount: Number(line.original_amount), share: line.share_percent, artistShare: artistPart(line),
  settled: Boolean(line.settlement_id), settlementId: line.settlement_id
});

const settlementView = (row) => row && {
  id: row.id, expected: Number(row.expected_amount), paid: Number(row.paid_amount), startedBy: row.started_by, salonPays: row.salon_pays !== false, status: row.status,
  otherAmount: row.other_amount === null ? null : Number(row.other_amount), createdAt: row.created_at, answeredAt: row.answered_at
};

/** The ledger of one pair: open lines with their totals, the settlement waiting for an answer, and the closed ones. */
export async function ledger(salonUserId, artistUserId) {
  await materializeLedger(salonUserId, artistUserId);
  const db = await getDb();
  const [lines, waiting, closed] = await Promise.all([
    all(db, "SELECT * FROM team_ledger_lines WHERE salon_user_id = $1 AND artist_user_id = $2 ORDER BY booking_date DESC, id DESC LIMIT 400", [Number(salonUserId), Number(artistUserId)]),
    get(db, "SELECT * FROM team_settlements WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'waiting' ORDER BY id DESC LIMIT 1", [Number(salonUserId), Number(artistUserId)]),
    all(db, "SELECT * FROM team_settlements WHERE salon_user_id = $1 AND artist_user_id = $2 AND status IN ('confirmed', 'disputed') ORDER BY id DESC LIMIT 12", [Number(salonUserId), Number(artistUserId)])
  ]);
  const open = lines.filter((line) => !line.settlement_id);
  const onWaiting = waiting ? lines.filter((line) => line.settlement_id === waiting.id) : [];
  const terms = await currentTerms(salonUserId, artistUserId, dateKeyAfter(0), db);
  return {
    totals: ledgerTotals(open),
    lines: open.map(lineView),
    waiting: waiting ? { ...settlementView(waiting), count: onWaiting.length } : null,
    closed: closed.map(settlementView),
    terms: { share: terms.share, ownShare: terms.ownShare, legacy: terms.legacy }
  };
}

/** The salon changes a line's price until it is settled (a discount, a price that was off); the first price stays visible. */
export async function setLineAmount({ salonUserId, artistUserId, id, amount }) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000_000) return { ok: false, code: "INVALID" };
  const db = await getDb();
  const row = await get(db, "UPDATE team_ledger_lines SET amount = $4 WHERE id = $1 AND salon_user_id = $2 AND artist_user_id = $3 AND settlement_id IS NULL RETURNING *", [Number(id), Number(salonUserId), Number(artistUserId), value]);
  return row ? { ok: true, line: lineView(row) } : { ok: false, code: "NOT_FOUND" };
}

/**
 * One side says «تصفیه کردیم» with what was paid. The open lines are held by it (settlement_id) until the other side
 * answers; a confirmed settlement closes them, a disputed or cancelled one frees them again.
 */
export async function startSettlement({ salonUserId, artistUserId, side, paid }) {
  const paidAmount = Number(paid);
  if (!Number.isInteger(paidAmount) || paidAmount <= 0 || paidAmount > 10_000_000_000) return { ok: false, code: "INVALID" };
  return withTransaction(null, async (db) => {
    await run(db, "SELECT 1 FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 FOR UPDATE", [Number(salonUserId), Number(artistUserId)]);
    if (await get(db, "SELECT 1 FROM team_settlements WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'waiting'", [Number(salonUserId), Number(artistUserId)])) return { ok: false, code: "WAITING" };
    const open = await all(db, "SELECT * FROM team_ledger_lines WHERE salon_user_id = $1 AND artist_user_id = $2 AND settlement_id IS NULL FOR UPDATE", [Number(salonUserId), Number(artistUserId)]);
    if (!open.length) return { ok: false, code: "EMPTY" };
    const totals = ledgerTotals(open);
    if (totals.unknown) return { ok: false, code: "NO_SHARE" };
    const row = await get(db, `
      INSERT INTO team_settlements (salon_user_id, artist_user_id, expected_amount, paid_amount, started_by, salon_pays) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [Number(salonUserId), Number(artistUserId), Math.abs(totals.net), paidAmount, side, totals.net > 0]);
    await run(db, "UPDATE team_ledger_lines SET settlement_id = $1 WHERE id = ANY($2::int[])", [row.id, open.map((line) => line.id)]);
    return { ok: true, settlement: settlementView(row), net: totals.net };
  });
}

/** The other side confirms the amount, or gives another one (the lines are freed and both numbers stay on record). */
export async function answerSettlement({ salonUserId, artistUserId, id, side, action, amount }) {
  return withTransaction(null, async (db) => {
    const row = await get(db, "SELECT * FROM team_settlements WHERE id = $1 AND salon_user_id = $2 AND artist_user_id = $3 FOR UPDATE", [Number(id), Number(salonUserId), Number(artistUserId)]);
    if (!row) return { ok: false, code: "NOT_FOUND" };
    if (row.status !== "waiting") return { ok: false, code: "CLOSED" };
    const mine = row.started_by === side;
    if (action === "cancel") {
      if (!mine) return { ok: false, code: "FORBIDDEN" };
      await run(db, "UPDATE team_settlements SET status = 'cancelled', answered_at = CURRENT_TIMESTAMP WHERE id = $1", [row.id]);
      await run(db, "UPDATE team_ledger_lines SET settlement_id = NULL WHERE settlement_id = $1", [row.id]);
      return { ok: true, settlement: settlementView({ ...row, status: "cancelled" }) };
    }
    if (mine) return { ok: false, code: "FORBIDDEN" };
    if (action === "confirm") {
      await run(db, "UPDATE team_settlements SET status = 'confirmed', answered_at = CURRENT_TIMESTAMP WHERE id = $1", [row.id]);
      return { ok: true, settlement: settlementView({ ...row, status: "confirmed" }) };
    }
    const other = Number(amount);
    if (!Number.isInteger(other) || other < 0 || other > 10_000_000_000) return { ok: false, code: "INVALID" };
    await run(db, "UPDATE team_settlements SET status = 'disputed', other_amount = $2, answered_at = CURRENT_TIMESTAMP WHERE id = $1", [row.id, other]);
    await run(db, "UPDATE team_ledger_lines SET settlement_id = NULL WHERE settlement_id = $1", [row.id]);
    return { ok: true, settlement: settlementView({ ...row, status: "disputed", other_amount: other }) };
  });
}
