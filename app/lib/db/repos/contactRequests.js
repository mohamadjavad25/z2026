import { randomBytes } from "node:crypto";
import { all, get, getDb, run, withTransaction } from "../connection.js";
import { lockClientRequests, lockContactPhone } from "../locks.js";
import { connect } from "./connections.js";
import { invalidateUnavailable } from "./salons/bookings/unavailable.js";
import { bookingStartMs } from "../../../shared/lib/reminderTiming.js";
import { isPersianDateKey } from "../../../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel } from "../../../shared/lib/time.js";
import { nowMs } from "../../../shared/lib/clock.js";

/**
 * Requests a client sends to a salon or artist that is not on frfro yet, picked from the phone's contacts (owner,
 * 2026-11-12; migration 082). The owner's answers of that day are the rules here:
 *  - frfro sends the SMS, at most one a day to a number (a later request that day waits on the same link page);
 *  - a client sends at most DAILY_LIMIT a day, and never two open ones to the same number for the same time;
 *  - a number that is a client's account is refused (one number is one account), a salon or artist is booked directly;
 *  - a request closes LEAD_HOURS before its time if nobody signed up for it;
 *  - once that number signs up as a salon or artist, every waiting request becomes a normal booking request there.
 */
export const DAILY_LIMIT = 3;
export const OPEN_LIMIT = 6;
export const LEAD_HOURS = 3;
const MAX_DAYS_AHEAD = 60;
const SETTLED_SHOWN_HOURS = 48;

const CODE_LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newRequestCode() {
  const bytes = randomBytes(10);
  return Array.from(bytes, (byte) => CODE_LETTERS[byte % CODE_LETTERS.length]).join("");
}

export function isRequestCode(code) {
  return /^[a-zA-Z0-9]{6,16}$/.test(String(code || ""));
}

/** Start of today in Tehran, for "per day" counts (Iran has no daylight saving). */
const TEHRAN_TODAY = "(date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran')";

/** Why a day and time cannot be asked for, or "" when they can. */
export function requestTimeProblem(bookingDate, time, now = nowMs()) {
  if (!isPersianDateKey(bookingDate) || !normalizeBookingTimeLabel(time)) return "روز و ساعت رو دوباره انتخاب کن.";
  const start = bookingStartMs(bookingDate, normalizeBookingTimeLabel(time), new Date(now));
  if (!start) return "روز و ساعت رو دوباره انتخاب کن.";
  if (start - now < LEAD_HOURS * 3600_000) return "برای کمتر از سه ساعت دیگه نمی‌شه؛ یه ساعت دیرتر انتخاب کن.";
  if (start - now > MAX_DAYS_AHEAD * 86400_000) return "تا دو ماه دیگه رو می‌شه انتخاب کرد.";
  return "";
}

export async function isOptedOut(phone, runner = null) {
  const db = runner || await getDb();
  return Boolean(await get(db, "SELECT 1 FROM contact_request_optouts WHERE phone = $1", [phone]));
}

/**
 * Adds a request (the caller checked the number is not an account). Returns
 *  { ok: true, request, sendSms } -- sendSms: this is the day's first request to that number, so the SMS goes now;
 *  { ok: true, request, duplicate: true } -- the same request was already there;
 *  { ok: false, code, message }.
 */
export async function addContactRequest({ clientUserId, phone, contactName, service, serviceEmoji, bookingDate, time }) {
  return withTransaction(null, async (db) => {
    await lockClientRequests(db, clientUserId);
    await lockContactPhone(db, phone);
    if (await isOptedOut(phone, db)) {
      return { ok: false, code: "OPTED_OUT", message: "این شماره نمی‌خواد از فرفرو پیام بگیره؛ یکی دیگه رو انتخاب کن." };
    }
    const same = await get(db, `
      SELECT * FROM contact_requests
      WHERE client_user_id = $1 AND phone = $2 AND booking_date = $3 AND time = $4 AND status = 'waiting'
    `, [clientUserId, phone, bookingDate, time]);
    if (same) return { ok: true, request: same, duplicate: true };
    const counts = await get(db, `
      SELECT
        COUNT(*) FILTER (WHERE created_at >= ${TEHRAN_TODAY})::int AS today,
        COUNT(*) FILTER (WHERE status = 'waiting')::int AS open
      FROM contact_requests WHERE client_user_id = $1
    `, [clientUserId]);
    if (counts.today >= DAILY_LIMIT) {
      return { ok: false, code: "DAILY_LIMIT", message: "امروز سه تا درخواست فرستادی؛ فردا دوباره بفرست." };
    }
    if (counts.open >= OPEN_LIMIT) {
      return { ok: false, code: "OPEN_LIMIT", message: "چند تا درخواست منتظر جواب داری؛ صبر کن جواب بیاد." };
    }
    const smsToday = await get(db, `
      SELECT 1 FROM contact_requests WHERE phone = $1 AND sms_status = 'sent' AND created_at >= ${TEHRAN_TODAY} LIMIT 1
    `, [phone]);
    const request = await get(db, `
      INSERT INTO contact_requests (code, client_user_id, phone, contact_name, service, service_emoji, booking_date, time, sms_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [newRequestCode(), clientUserId, phone, contactName, service, serviceEmoji, bookingDate, time, smsToday ? "joined" : ""]);
    return { ok: true, request, sendSms: !smsToday };
  });
}

/** Writes how the SMS went: sent | off (SMS or its pattern is not set up) | failed. */
export async function setSmsStatus(id, status) {
  const db = await getDb();
  await run(db, "UPDATE contact_requests SET sms_status = $2 WHERE id = $1", [id, status]);
}

/** The client's requests to show: waiting ones, and ones that closed in the last two days without becoming a booking. */
export async function listClientRequests(clientUserId) {
  const db = await getDb();
  return all(db, `
    SELECT id, code, contact_name, phone, service, service_emoji, booking_date, time, status, sms_status, created_at, settled_at
    FROM contact_requests
    WHERE client_user_id = $1
      AND (status = 'waiting' OR (status IN ('expired', 'declined') AND settled_at > now() - INTERVAL '${SETTLED_SHOWN_HOURS} hours'))
    ORDER BY created_at DESC
    LIMIT 20
  `, [clientUserId]);
}

/** The client takes a waiting request back. Returns the row, or null when it is not theirs or no longer waiting. */
export async function cancelClientRequest(clientUserId, id) {
  const db = await getDb();
  return get(db, `
    UPDATE contact_requests SET status = 'cancelled', settled_at = now()
    WHERE id = $1 AND client_user_id = $2 AND status = 'waiting'
    RETURNING *
  `, [id, clientUserId]);
}

/** The client hides a closed request from their home. */
export async function dismissClientRequest(clientUserId, id) {
  const db = await getDb();
  return get(db, `
    UPDATE contact_requests SET status = 'cancelled'
    WHERE id = $1 AND client_user_id = $2 AND status IN ('expired', 'declined')
    RETURNING id
  `, [id, clientUserId]);
}

/**
 * What the link page shows for a code: every request still waiting for that code's number (several clients may have
 * asked the same salon), with the client's name only. null for an unknown code.
 */
export async function requestsForCode(code) {
  if (!isRequestCode(code)) return null;
  const db = await getDb();
  const own = await get(db, "SELECT phone, status, business_user_id FROM contact_requests WHERE code = $1", [code]);
  if (!own) return null;
  const rows = await all(db, `
    SELECT r.id, r.service, r.service_emoji, r.booking_date, r.time, u.name AS client_name
    FROM contact_requests r JOIN users u ON u.id = r.client_user_id
    WHERE r.phone = $1 AND r.status = 'waiting'
    ORDER BY r.booking_date, r.time
  `, [own.phone]);
  return { phone: own.phone, status: own.status, delivered: own.status === "delivered", requests: rows };
}

/** «دیگه پیام نده» on the link page: no more messages to that number, and its waiting requests are declined. */
export async function optOutByCode(code) {
  if (!isRequestCode(code)) return null;
  return withTransaction(null, async (db) => {
    const own = await get(db, "SELECT phone FROM contact_requests WHERE code = $1", [code]);
    if (!own) return null;
    await lockContactPhone(db, own.phone);
    await run(db, "INSERT INTO contact_request_optouts (phone) VALUES ($1) ON CONFLICT (phone) DO NOTHING", [own.phone]);
    return all(db, `
      UPDATE contact_requests SET status = 'declined', settled_at = now()
      WHERE phone = $1 AND status = 'waiting'
      RETURNING id, client_user_id, contact_name, service
    `, [own.phone]);
  });
}

/** The number a code was sent to, or "". */
export async function phoneForCode(code) {
  if (!isRequestCode(code)) return "";
  const db = await getDb();
  return (await get(db, "SELECT phone FROM contact_requests WHERE code = $1", [code]))?.phone || "";
}

/**
 * Hands every waiting request for `phone` to a salon or artist account: each becomes a booking request there (the
 * salon's «درخواست», the artist's «تازه»), waiting until its own time, and the client is connected to the new place.
 * A request whose time already began is closed instead. Returns [{ request, bookingId }] for what was handed over.
 */
export async function deliverToBusiness(business, phone) {
  const kind = business?.type === "salon" ? "salon" : business?.type === "artist" ? "artist" : "";
  if (!kind || !phone) return [];
  const delivered = await withTransaction(null, async (db) => {
    await lockContactPhone(db, phone);
    const rows = await all(db, `
      SELECT r.*, u.name AS client_name, u.phone AS client_phone
      FROM contact_requests r JOIN users u ON u.id = r.client_user_id
      WHERE r.phone = $1 AND r.status = 'waiting'
      ORDER BY r.created_at
    `, [phone]);
    const handed = [];
    for (const row of rows) {
      const start = bookingStartMs(row.booking_date, row.time, new Date(nowMs()));
      if (!start || start <= nowMs()) {
        await run(db, "UPDATE contact_requests SET status = 'expired', settled_at = now() WHERE id = $1", [row.id]);
        continue;
      }
      let bookingId;
      if (kind === "salon") {
        const made = await get(db, `
          INSERT INTO salon_bookings
            (salon_user_id, client_user_id, client, phone, service, service_emoji, staff, booking_date, time, duration_minutes, status, wait_minutes)
          VALUES ($1, $2, $3, $4, $5, $6, '', $7, $8, 60, 'درخواست', NULL)
          RETURNING id
        `, [business.id, row.client_user_id, row.client_name || "", row.client_phone || "", row.service, row.service_emoji || "", row.booking_date, row.time]);
        bookingId = Number(made.id);
      } else {
        const made = await get(db, `
          INSERT INTO artist_bookings
            (artist_user_id, client_user_id, client_name, client_phone, service, service_emoji, booking_date, time, duration_minutes, status, wait_minutes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 60, 'تازه', NULL)
          RETURNING id
        `, [business.id, row.client_user_id, row.client_name || "", row.client_phone || "", row.service, row.service_emoji || "", row.booking_date, row.time]);
        bookingId = Number(made.id);
      }
      await run(db, `
        UPDATE contact_requests
        SET status = 'delivered', settled_at = now(), business_user_id = $2, booking_kind = $3, booking_id = $4
        WHERE id = $1
      `, [row.id, business.id, kind, bookingId]);
      handed.push({ request: row, bookingId });
    }
    return handed;
  });
  if (kind === "salon" && delivered.length) invalidateUnavailable(business.id);
  // The client now has this place in «سالن و آرتیست من» (after the commit: connect() reads the account as live).
  for (const clientUserId of new Set(delivered.map(({ request }) => Number(request.client_user_id)))) {
    await connect(clientUserId, business.id).catch(() => null);
  }
  return delivered;
}

/** Waiting requests whose time is now less than LEAD_HOURS away: closed as expired. Returns the closed rows. */
export async function expireDueRequests(now = nowMs()) {
  const db = await getDb();
  const waiting = await all(db, "SELECT id, booking_date, time FROM contact_requests WHERE status = 'waiting'");
  const due = waiting
    .filter((row) => {
      const start = bookingStartMs(row.booking_date, row.time, new Date(now));
      return !start || start - now <= LEAD_HOURS * 3600_000;
    })
    .map((row) => row.id);
  if (!due.length) return [];
  return all(db, `
    UPDATE contact_requests SET status = 'expired', settled_at = now()
    WHERE id = ANY($1) AND status = 'waiting'
    RETURNING id, client_user_id, contact_name, service
  `, [due]);
}
