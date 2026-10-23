import pg from "pg";
import { createClient, registerUser, joinSalonAsArtist, futureBookingDay } from "./helpers.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { scheduleBookingParts, parseBookingParts } from "../../app/shared/lib/bookingParts.js";
import { timeLabelToMinutes } from "../../app/shared/lib/time.js";

export { createClient, registerUser, joinSalonAsArtist, futureBookingDay, TEST_BASE_URL };

export function openDb() {
  const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
  const connected = db.connect();
  return { db, connected };
}

export const INACTIVE = ["لغو", "منقضی شده"];
const ARTIST_INACTIVE = ["لغو", "لغو شده", "cancelled", "منقضی شده"];

/** Salon with `staffCount` artists on its team and the given services ({ name, duration }). */
export async function makeSalon(name, { staffCount = 0, services = [{ name: "S30", duration: "۳۰ دقیقه" }] } = {}) {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name });
  await salonClient.get("/api/salon-hours");
  const staff = [];
  for (let index = 0; index < staffCount; index += 1) {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: `${name} Artist ${index + 1}` });
    const joined = await joinSalonAsArtist(artistClient, salonClient, salon.user.id);
    if (!joined.ok) throw new Error(`join failed ${JSON.stringify(joined.payload)}`);
    staff.push({ artistClient, artist });
  }
  const rows = (await salonClient.get("/api/salon-staff")).payload.data.staff;
  for (const person of staff) person.row = rows.find((row) => Number(row.artist_user_id) === Number(person.artist.user.id));
  const created = [];
  for (const service of services) {
    const res = await salonClient.post("/api/salon-services", { name: service.name, price: "100", duration: service.duration });
    if (!res.ok) throw new Error(`service failed ${JSON.stringify(res.payload)}`);
    created.push(res.payload.data.service);
  }
  return { salonClient, salon, staff, services: created };
}

export async function makeClient(name = "A1 Client") {
  const client = createClient();
  const account = await registerUser(client, { type: "client", name });
  return { client, ...account };
}

export function requestSlot(c, salonId, { service = "S30", parts, day, time, waitMinutes, fallbackSalonUserId } = {}) {
  return c.client.post("/api/salon-bookings", {
    salonUserId: salonId,
    ...(parts ? { parts: parts.map((p) => ({ service: p })) } : { service }),
    bookingDate: day,
    time,
    ...(waitMinutes !== undefined ? { waitMinutes } : {}),
    ...(fallbackSalonUserId ? { fallbackSalonUserId } : {})
  });
}

export const sweep = async () => {
  const res = await fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
  return { status: res.status, data: (await res.json().catch(() => ({}))).data };
};

export const sendBack = (db, id, minutes, table = "salon_bookings") => db.query(`UPDATE ${table} SET created_at = NOW() - ($2::int * INTERVAL '1 minute') WHERE id = $1`, [id, minutes]);

/** Every violation of "nobody is in two places at once" in a salon's active bookings and in the artists' own calendars. */
export async function overlapViolations(db, salonUserId, dayKey) {
  const out = [];
  const salonRows = (await db.query(
    `SELECT id, staff, time, duration_minutes, parts, status FROM salon_bookings WHERE salon_user_id = $1 AND ($2::text IS NULL OR booking_date = $2) AND status <> ALL($3)`,
    [salonUserId, dayKey || null, INACTIVE]
  )).rows;
  const segs = [];
  for (const row of salonRows) {
    const list = parseBookingParts(row.parts);
    if (list.length >= 2) for (const p of scheduleBookingParts(row.time, row.parts)) segs.push({ id: row.id, staff: p.staff, start: p.start, end: p.end });
    else {
      const start = timeLabelToMinutes(row.time);
      segs.push({ id: row.id, staff: String(row.staff || "").trim(), start, end: start + Math.max(15, Number(row.duration_minutes) || 60) });
    }
  }
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      const a = segs[i];
      const b = segs[j];
      if (a.id === b.id) continue;
      // only a named person can be double-booked; unassigned rows are checked by their own rule
      if (a.staff && a.staff === b.staff && a.start < b.end && b.start < a.end) out.push(`salon staff ${a.staff}: #${a.id} ${a.start}-${a.end} vs #${b.id} ${b.start}-${b.end}`);
    }
  }
  const artistRows = (await db.query(
    `SELECT id, artist_user_id, time, duration_minutes, status, booking_date FROM artist_bookings WHERE status <> ALL($1) AND ($2::text IS NULL OR booking_date = $2) AND (source_salon_user_id = $3 OR source_salon_user_id IS NULL)`,
    [ARTIST_INACTIVE, dayKey || null, salonUserId]
  )).rows;
  const ids = new Set((await db.query(`SELECT artist_user_id FROM salon_staff WHERE salon_user_id = $1`, [salonUserId])).rows.map((r) => Number(r.artist_user_id)));
  const mine = artistRows.filter((r) => ids.has(Number(r.artist_user_id)));
  for (let i = 0; i < mine.length; i += 1) {
    for (let j = i + 1; j < mine.length; j += 1) {
      const a = mine[i];
      const b = mine[j];
      if (a.artist_user_id !== b.artist_user_id || a.booking_date !== b.booking_date) continue;
      const as = timeLabelToMinutes(a.time);
      const bs = timeLabelToMinutes(b.time);
      const ae = as + Math.max(15, Number(a.duration_minutes) || 60);
      const be = bs + Math.max(15, Number(b.duration_minutes) || 60);
      if (as < be && bs < ae) out.push(`artist ${a.artist_user_id}: #${a.id} ${a.time}+${a.duration_minutes} vs #${b.id} ${b.time}+${b.duration_minutes}`);
    }
  }
  return out;
}

export const statusOf = async (c, id) => (await c.client.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id)?.status;
export const salonView = async (salonClient, id) => (await salonClient.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id);

/** start times (from the availability list) a client could still request now */
export async function feasibleTimes(c, salonId, day, services, minutes) {
  const params = new URLSearchParams({ salonUserId: String(salonId), day });
  services.forEach((s) => params.append("service", s));
  (minutes || []).forEach((m) => params.append("minutes", String(m)));
  const res = await c.client.get(`/api/salon-bookings/availability?${params}`);
  return res.payload?.data?.times || [];
}
