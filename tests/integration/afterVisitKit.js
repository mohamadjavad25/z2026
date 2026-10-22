import pg from "pg";
import { expect } from "vitest";
import { createClient, registerUser, joinSalonAsArtist, futureBookingDay } from "./helpers.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { getTehranClockMinutes, minutesToPersianTime } from "../../app/shared/lib/time.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";

/**
 * Shared pieces for the "after the visit" tests (afterVisit.test.js, afterVisitBots.test.js): people,
 * bookings, the two cron sweeps, and a time machine. Time is moved in the database (booking_date / time),
 * because the server runs on the real clock.
 */
export const CONFIRMED = "تایید شده";
export const CANCELLED = "لغو";
export const EXPIRED = "منقضی شده";
export const PENDING_SALON = "درخواست";
export const PENDING_ARTIST = "تازه";

export function openDb() {
  const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
  const ready = db.connect().then(() => db);
  return { query: async (sql, params) => (await ready).query(sql, params), end: async () => (await ready).end() };
}

export const todayKey = () => formatPersianDateKey(new Date());
export const daysAgoKey = (days) => formatPersianDateKey(new Date(Date.now() - days * 86400000));
export const tehranMinutes = () => getTehranClockMinutes(new Date());
/** "HH:MM" `minutes` before now (Tehran); only meaningful when tehranMinutes() >= minutes. */
export const clockAgo = (minutes) => minutesToPersianTime(tehranMinutes() - minutes);

export async function expirySweep() {
  const res = await fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
  expect(res.status).toBe(200);
  return (await res.json()).data;
}

export async function reminderSweep(now = new Date()) {
  const res = await fetch(`${TEST_BASE_URL}/api/cron/send-reminders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TEST_CRON_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ now: now.toISOString() })
  });
  expect(res.status).toBe(200);
  return (await res.json()).data;
}

export async function newSalon(name, { withArtist = false } = {}) {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: `${name} Salon` });
  await salonClient.get("/api/salon-hours");
  const ctx = { kind: "salon", salonClient, salon, id: salon.user.id };
  if (withArtist) {
    ctx.artistClient = createClient();
    ctx.artist = await registerUser(ctx.artistClient, { type: "artist", name: `${name} Staff` });
    expect((await joinSalonAsArtist(ctx.artistClient, salonClient, salon.user.id)).ok).toBe(true);
    ctx.staffName = (await salonClient.get("/api/salon-staff")).payload.data.staff[0].name;
  }
  return ctx;
}

export async function newDirectArtist(name) {
  const artistClient = createClient();
  const artist = await registerUser(artistClient, { type: "artist", name });
  return { kind: "artist", artistClient, artist, id: artist.user.id };
}

export async function newClient(name) {
  const api = createClient();
  const user = await registerUser(api, { type: "client", name });
  return { api, user: user.user, phone: user.phone };
}

/** Client asks a salon; returns the raw response so bots can see refusals too. */
export function requestSalon(ctx, who, { day = futureBookingDay(2), time = "10:00", staff } = {}) {
  return who.api.post("/api/salon-bookings", {
    salonUserId: ctx.salon.user.id, service: "کوتاهی مو", bookingDate: day, time, staff, client: who.user.name, phone: who.phone
  });
}

export function requestArtist(a, who, { day = futureBookingDay(2), time = "10:00" } = {}) {
  return who.api.post("/api/artist/bookings", { artistUserId: a.artist.user.id, service: "ناخن", bookingDate: day, time });
}

export const confirmSalon = (ctx, id) => ctx.salonClient.patch("/api/salon-bookings", { id, status: CONFIRMED });
export const cancelBySalon = (ctx, id) => ctx.salonClient.patch("/api/salon-bookings", { id, status: CANCELLED });
export const confirmArtist = (a, id) => a.artistClient.patch("/api/artist/me", { kind: "booking", id, status: CONFIRMED });
export const cancelByArtist = (a, id) => a.artistClient.patch("/api/artist/me", { kind: "booking", id, status: CANCELLED });
export const cancelByClient = (who, table, id) => who.api.post(`/api/${table === "salon_bookings" ? "salon-bookings" : "artist-bookings"}/${id}/cancel`, {});

export async function salonRow(ctx, id) {
  return (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id);
}
export async function clientSalonRow(who, id) {
  return (await who.api.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id);
}
export async function artistRow(a, id) {
  return (await a.artistClient.get("/api/artist/me")).payload.data.bookings.find((b) => b.id === id);
}
export async function clientArtistRow(who, id) {
  return (await who.api.get("/api/artist-bookings")).payload.data.bookings.find((b) => b.id === id);
}

/**
 * Time machine: puts a booking on another day/time. A salon booking takes its team artist's mirror row
 * (same client, phone, service, day and time) along, in the same statement, as the app keeps them together.
 */
export async function moveBooking(db, table, id, { date, time }) {
  if (table === "salon_bookings") {
    await db.query(`
      WITH old AS (SELECT * FROM salon_bookings WHERE id = $1),
      mirror AS (
        UPDATE artist_bookings a SET booking_date = $2, time = COALESCE($3, a.time)
        FROM old
        WHERE a.source_salon_user_id = old.salon_user_id AND a.client_name = old.client AND a.client_phone = old.phone
          AND a.service = old.service AND a.booking_date = old.booking_date AND a.time = old.time
        RETURNING a.id
      )
      UPDATE salon_bookings SET booking_date = $2, time = COALESCE($3, time) WHERE id = $1
    `, [id, date, time ?? null]);
    return;
  }
  await db.query(`UPDATE ${table} SET booking_date = $2, time = COALESCE($3, time) WHERE id = $1`, [id, date, time ?? null]);
}
/** The booking's appointment was `days` days ago (same clock time). */
export const moveToDaysAgo = (db, table, id, days) => moveBooking(db, table, id, { date: daysAgoKey(days) });
/** The booking started `minutes` ago today. Only when tehranMinutes() > minutes. */
export const moveToStartedAgo = (db, table, id, minutes) => moveBooking(db, table, id, { date: todayKey(), time: clockAgo(minutes) });

/** Booking-answer texts sent to a phone (the "test" SMS provider keeps them in sms_log). SMS is fire-and-forget, so wait a little. */
export async function answerSmsTo(db, phone, { waitMs = 600 } = {}) {
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const { rows } = await db.query("SELECT body FROM sms_log WHERE phone = $1 AND purpose = 'booking_answer' ORDER BY id", [phone]);
  return rows.map((row) => row.body);
}
