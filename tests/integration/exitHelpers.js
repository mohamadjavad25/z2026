import pg from "pg";
import { createClient, registerUser, joinSalonAsArtist, futureBookingDay } from "./helpers.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { getTehranClockMinutes } from "../../app/shared/lib/time.js";

export { createClient, registerUser, joinSalonAsArtist, futureBookingDay };

/** Helpers of the tests for the owner's rules of 2026-10-22 (leaving, proposals, provider cancellations). Not a test file. */
export const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
export const connected = db.connect();
export const q = async (sql, params = []) => { await connected; return (await db.query(sql, params)).rows; };

export const FAR_DAY = (n = 3) => futureBookingDay(n);
const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The day key and "HH:MM" (Tehran time) of the instant `minutes` from now. */
export function slotAhead(minutes) {
  const at = new Date(Date.now() + minutes * 60000);
  return { date: formatPersianDateKey(at), time: hh(getTehranClockMinutes(at)) };
}

export async function newSalon(name = "Exit Salon") {
  const api = createClient();
  const reg = await registerUser(api, { type: "salon", name, menu: true });
  await api.get("/api/salon-hours");
  return { api, ...reg, id: reg.user.id };
}
export async function newClient(name = "Exit Client") {
  const api = createClient();
  const reg = await registerUser(api, { type: "client", name });
  return { api, ...reg, id: reg.user.id };
}
export async function newArtist(name = "Exit Artist") {
  const api = createClient();
  const reg = await registerUser(api, { type: "artist", name, menu: true });
  return { api, ...reg, id: reg.user.id };
}
/** A salon with `n` artists on its team (each joined through the real invite path). */
export async function teamSalon(name, n = 2) {
  const salon = await newSalon(name);
  const members = [];
  for (let i = 0; i < n; i += 1) {
    const artist = await newArtist(`${name} Artist ${i + 1}`);
    const joined = await joinSalonAsArtist(artist.api, salon.api, salon.id);
    if (!joined.ok) throw new Error(`join failed ${JSON.stringify(joined.payload)}`);
    members.push(artist);
  }
  const rows = (await salon.api.get("/api/salon-staff")).payload.data.staff;
  for (const member of members) member.staff = rows.find((row) => Number(row.artist_user_id) === member.id);
  return { salon, members };
}

/** A client's request at a salon (optionally for one team member), approved by the salon: a confirmed booking. */
export async function confirmedAt(salon, client, { day = FAR_DAY(3), time = "11:00", staff = "", service = "کوتاهی مو" } = {}) {
  const made = await client.api.post("/api/salon-bookings", { salonUserId: salon.id, service, ...(staff ? { staff } : {}), bookingDate: day, time, client: client.user.name, phone: client.phone });
  if (made.status !== 201) throw new Error(`booking failed ${made.status} ${JSON.stringify(made.payload)}`);
  const id = made.payload.data.booking.id;
  const ok = await salon.api.patch("/api/salon-bookings", { id, status: "تایید شده" });
  if (!ok.ok) throw new Error(`approve failed ${JSON.stringify(ok.payload)}`);
  return id;
}

/** Moves a salon booking (and its calendar copies) to `minutes` from now by writing the database, so "within 24 hours" is exact. */
export async function moveSalonBookingNear(id, minutes) {
  const { date, time } = slotAhead(minutes);
  const [row] = await q("SELECT * FROM salon_bookings WHERE id = $1", [id]);
  await q("UPDATE artist_bookings SET booking_date = $1, time = $2 WHERE source_salon_user_id = $3 AND client_name = $4 AND booking_date = $5 AND time = $6", [date, time, row.salon_user_id, row.client, row.booking_date, row.time]);
  await q("UPDATE salon_bookings SET booking_date = $1, time = $2 WHERE id = $3", [date, time, id]);
  return { date, time };
}

export async function directConfirmed(artist, client, { day = FAR_DAY(3), time = "11:00" } = {}) {
  const made = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "کوتاهی مو", bookingDate: day, time });
  if (made.status !== 201) throw new Error(`artist booking failed ${made.status} ${JSON.stringify(made.payload)}`);
  const id = made.payload.data.booking.id;
  const ok = await artist.api.patch("/api/artist/me", { kind: "booking", id, status: "تایید شده" });
  if (!ok.ok) throw new Error(`artist approve failed ${JSON.stringify(ok.payload)}`);
  return id;
}
export async function moveArtistBookingNear(id, minutes) {
  const { date, time } = slotAhead(minutes);
  await q("UPDATE artist_bookings SET booking_date = $1, time = $2 WHERE id = $3", [date, time, id]);
  return { date, time };
}

export const salonRow = async (id) => (await q("SELECT * FROM salon_bookings WHERE id = $1", [id]))[0];
export const artistRow = async (id) => (await q("SELECT * FROM artist_bookings WHERE id = $1", [id]))[0];
export const counter = async (userId) => (await q("SELECT provider_cancel_count FROM users WHERE id = $1", [userId]))[0].provider_cancel_count;
export const smsOf = (phone, purpose) => q("SELECT purpose, body FROM sms_log WHERE phone = $1 AND purpose = $2 ORDER BY id", [phone, purpose]);

/** SMS are sent without the request waiting: poll until the wanted count shows up (or give up and return what is there). */
export async function smsEventually(phone, purpose, want = 1, ms = 6000) {
  const deadline = Date.now() + ms;
  let rows = await smsOf(phone, purpose);
  while (rows.length < want && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    rows = await smsOf(phone, purpose);
  }
  return rows;
}
/** Waits a moment for stray SMS to arrive, then counts (for «exactly one», never «none yet»). */
export async function smsSettled(phone, purposes, quietMs = 1200) {
  await new Promise((r) => setTimeout(r, quietMs));
  const rows = await q("SELECT purpose FROM sms_log WHERE phone = $1 AND purpose = ANY($2)", [phone, purposes]);
  return rows.length;
}

export async function cron(path) {
  const res = await fetch(`${TEST_BASE_URL}/api/cron/${path}`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
  return { status: res.status, data: (await res.json().catch(() => ({}))).data };
}

export const propose = (who, body) => who.api.post("/api/booking-proposals", body);
export const answer = (client, body) => client.api.post("/api/booking-proposals/answer", body);
export const exitPlan = (who, query) => who.api.get(`/api/provider-exit?${new URLSearchParams(query)}`);
export const exitCancel = (who, body) => who.api.post("/api/provider-exit", body);
export const deleteMe = (who, body = {}) => who.api.delete("/api/profile", { currentPassword: who.password, ...body });
