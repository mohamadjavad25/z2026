import pg from "pg";
import { appendFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { makeSalon, makeClient, INACTIVE, overlapViolations } from "./angle1Helpers.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { timeLabelToMinutes } from "../../app/shared/lib/time.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

export { createClient, registerUser, futureBookingDay, makeSalon, makeClient, overlapViolations, INACTIVE, TEST_BASE_URL };

/** Load tests for "Package 1" share these helpers. A request that takes more than HANG_MS counts as hung. */
export const HANG_MS = 30_000;
export const note = (...args) => {
  const line = args.map((arg) => (typeof arg === "object" && arg ? JSON.stringify(arg) : String(arg))).join(" ");
  console.log("[p1-stress]", line);
  if (process.env.P1_LOG) appendFileSync(process.env.P1_LOG, `${line}\n`);
};

export function openDb() {
  const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
  const connected = db.connect();
  return { db, connected };
}

/** The per-user / per-artist booking throttles (20 a minute) would otherwise hide the real behaviour of a big burst. */
export const clearThrottles = (db) => db.query("DELETE FROM rate_limit_hits");

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const jitter = (maxMs) => sleep(Math.floor(Math.random() * maxMs));

/** One HTTP call that never throws: returns { status, payload, ms, hung, error }. status 0 = no answer (reset or timeout). */
export async function call(client, method, path, body, extraHeaders = {}) {
  const started = Date.now();
  try {
    const res = await fetch(`${TEST_BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(client?.cookie?.() ? { Cookie: client.cookie() } : {}), ...extraHeaders },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(HANG_MS)
    });
    const text = await res.text();
    let payload = {};
    try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 200) }; }
    return { status: res.status, payload, ms: Date.now() - started, hung: false };
  } catch (error) {
    return { status: 0, payload: {}, ms: Date.now() - started, hung: /timeout|abort/i.test(String(error?.name) + String(error?.message)), error: String(error?.message || error) };
  }
}
export const get = (client, path) => call(client, "GET", path);
export const post = (client, path, body) => call(client, "POST", path, body);
export const patch = (client, path, body) => call(client, "PATCH", path, body);

export const tally = (results) => results.reduce((acc, r) => ({ ...acc, [r.status + (r.status >= 400 && r.payload?.code ? `/${r.payload.code}` : "")]: (acc[r.status + (r.status >= 400 && r.payload?.code ? `/${r.payload.code}` : "")] || 0) + 1 }), {});
export const bad = (results) => results.filter((r) => r.status === 0 || r.status >= 500);

export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
export const latency = (results) => {
  const ms = results.map((r) => r.ms);
  return `p50=${percentile(ms, 50)}ms p95=${percentile(ms, 95)}ms max=${Math.max(0, ...ms)}ms`;
};

/** n client accounts, registered a few at a time (sign-up hashes a password, so doing 100 at once would only measure that). */
export async function makeClients(n, label = "P1 Client", concurrency = 6) {
  const out = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, n) }, async () => {
    while (next < n) {
      const index = next;
      next += 1;
      out[index] = await makeClient(`${label} ${index}`);
    }
  }));
  return out;
}

export const sweepNow = async () => {
  const started = Date.now();
  const res = await fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` }, signal: AbortSignal.timeout(HANG_MS) }).catch((error) => ({ status: 0, error, json: async () => ({}) }));
  return { status: res.status, data: (await res.json().catch(() => ({}))).data, ms: Date.now() - started, payload: {} };
};

export const slotBody = (salonId, { day, time, service = "S30", extra = {} }) => ({ salonUserId: salonId, service, bookingDate: day, time, ...extra });

/** Max number of salon bookings that are active (not cancelled / expired) at the same minute, counting every booking whole. */
export async function peakConcurrent(db, salonUserId, dayKey) {
  const rows = (await db.query(
    `SELECT id, time, duration_minutes, parts FROM salon_bookings WHERE salon_user_id = $1 AND booking_date = $2 AND status <> ALL($3)`,
    [salonUserId, dayKey, INACTIVE]
  )).rows;
  let peak = 0;
  for (const a of rows) {
    const start = timeLabelToMinutes(a.time);
    const at = rows.filter((b) => {
      const bs = timeLabelToMinutes(b.time);
      return bs <= start && start < bs + Math.max(15, Number(b.duration_minutes) || 60);
    }).length;
    peak = Math.max(peak, at);
  }
  return peak;
}

/** Every active salon booking with a named artist has exactly one live calendar copy with the same time, and no live copy is without its booking. */
export async function calendarMismatches(db, salonUserId, dayKey) {
  const problems = [];
  const bookings = (await db.query(
    `SELECT id, staff, time, status FROM salon_bookings WHERE salon_user_id = $1 AND booking_date = $2`, [salonUserId, dayKey]
  )).rows;
  const copies = (await db.query(
    `SELECT id, artist_user_id, time, status, client_name, service, salon_booking_id FROM artist_bookings WHERE source_salon_user_id = $1 AND booking_date = $2`, [salonUserId, dayKey]
  )).rows;
  const dead = (s) => ["لغو", "لغو شده", "cancelled", "منقضی شده"].includes(s);
  const liveCopies = copies.filter((c) => !dead(c.status));
  const liveBookings = bookings.filter((b) => !INACTIVE.includes(b.status));
  const withArtist = liveBookings.filter((b) => String(b.staff || "").trim());
  if (liveCopies.length !== withArtist.length) problems.push(`live bookings with an artist ${withArtist.length} vs live calendar copies ${liveCopies.length}`);
  return problems;
}

/** Locks, open transactions and waiting backends other than this connection. */
export async function pgLeftovers(db) {
  const idleInTx = (await db.query(
    `SELECT pid, state, wait_event_type, now() - xact_start AS age, left(query, 120) AS query FROM pg_stat_activity
     WHERE datname = current_database() AND pid <> pg_backend_pid() AND state IN ('idle in transaction', 'idle in transaction (aborted)')`
  )).rows;
  const waiting = (await db.query(
    `SELECT l.pid, l.locktype, l.mode FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
     WHERE NOT l.granted AND a.datname = current_database() AND a.pid <> pg_backend_pid()`
  )).rows;
  const advisory = (await db.query(
    `SELECT l.pid FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
     WHERE l.locktype = 'advisory' AND a.datname = current_database() AND a.pid <> pg_backend_pid()`
  )).rows;
  const active = (await db.query(
    `SELECT pid, state, left(query, 100) AS query FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND state = 'active'`
  )).rows;
  return { idleInTx, waiting, advisory, active };
}

export async function healthy() {
  try {
    const res = await fetch(`${TEST_BASE_URL}/api/health`, { signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * A salon (made by makeSalon with 5 staff) that has a long history: 26 confirmed bookings on each of the next 62 days
 * (1612 rows) with a calendar copy for each, spread over its artists. Written straight into the tables.
 */
export async function seedHistory(db, ctx, { skipDayKey = "" } = {}) {
  const staff = (await db.query("SELECT name, artist_user_id FROM salon_staff WHERE salon_user_id = $1 ORDER BY id", [ctx.salon.user.id])).rows;
  const rows = [];
  for (let i = 1; i <= 62; i += 1) {
    const key = formatPersianDateKey(new Date(Date.now() + i * 86400000));
    if (key === skipDayKey) continue;
    for (let n = 0; n < 26; n += 1) {
      const s = staff[n % staff.length];
      const minutes = 10 * 60 + Math.floor(n / staff.length) * 90;
      rows.push({ key, staff: s.name, artist: s.artist_user_id, time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`, n });
    }
  }
  await db.query(
    `INSERT INTO salon_bookings (salon_user_id, client, phone, service, staff, booking_date, time, duration_minutes, status)
     SELECT $1, 'قدیمی ' || t.n, '09120000000', 'S30', t.staff, t.key, t.time, 30, 'تایید شده'
     FROM unnest($2::text[], $3::text[], $4::text[], $5::int[]) AS t(key, staff, time, n)`,
    [ctx.salon.user.id, rows.map((r) => r.key), rows.map((r) => r.staff), rows.map((r) => r.time), rows.map((r) => r.n)]
  );
  await db.query(
    `INSERT INTO artist_bookings (artist_user_id, source_salon_user_id, client_name, client_phone, service, booking_date, time, duration_minutes, status)
     SELECT t.artist, $1, 'قدیمی', '09120000000', 'S30', t.key, t.time, 30, 'تایید شده'
     FROM unnest($2::text[], $3::int[], $4::text[]) AS t(key, artist, time)`,
    [ctx.salon.user.id, rows.map((r) => r.key), rows.map((r) => Number(r.artist)), rows.map((r) => r.time)]
  );
  return rows.length;
}

/** Lines the Postgres server log gained since `offset` (bytes); the log must be readable by this user. */
export const PG_LOG = process.env.P1_PG_LOG || "/var/log/postgresql/postgresql-16-main.log";
export function pgLogSize() {
  try { return statSync(PG_LOG).size; } catch { return -1; }
}
export function pgLogSince(offset) {
  if (offset < 0) return "";
  try {
    const size = statSync(PG_LOG).size;
    const fd = openSync(PG_LOG, "r");
    const buffer = Buffer.alloc(Math.max(0, size - offset));
    readSync(fd, buffer, 0, buffer.length, offset);
    closeSync(fd);
    return buffer.toString("utf8");
  } catch { return ""; }
}
