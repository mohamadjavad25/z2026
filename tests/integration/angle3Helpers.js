import pg from "pg";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { TEST_BASE_URL } from "../globalSetup.js";

export const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
export const connected = db.connect();

let ipCounter = 0;
/** A fresh fake client address so per-IP throttles behave as they would for real visitors. */
export const freshIp = () => {
  ipCounter += 1;
  return `10.55.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
};
export const ipHeaders = (ip = freshIp()) => ({ "x-real-ip": ip });

export const uniq = () => Math.random().toString(36).slice(2, 8);

export async function newSalon(name = "Angle3 Salon", services = [["کراتین مو", "100", "60 دقیقه"]]) {
  const client = createClient();
  const account = await registerUser(client, { type: "salon", name: `${name} ${uniq()}` });
  await client.get("/api/salon-hours");
  for (const [n, price, duration] of services) {
    const res = await client.post("/api/salon-services", { name: n, price, duration });
    if (!res.ok) throw new Error(`service create failed ${JSON.stringify(res.payload)}`);
  }
  return { client, ...account };
}

export async function newClient(name = "Angle3 Client", extra = {}) {
  const client = createClient();
  const account = await registerUser(client, { type: "client", name: `${name} ${uniq()}`, ...extra });
  return { client, ...account };
}

export async function newArtist(name = "Angle3 Artist") {
  const client = createClient();
  const account = await registerUser(client, { type: "artist", name: `${name} ${uniq()}` });
  // A client can only book a service on the artist's own menu (decision 2026-10-21).
  const service = await client.post("/api/artist/me", { name: "ناخن", price: "100", duration: "60 دقیقه" });
  if (!service.ok) throw new Error(`artist service failed ${JSON.stringify(service.payload)}`);
  return { client, ...account };
}

export const hhmm = (hour, minute = 0) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

/** POST a salon booking request as a client. */
export function bookSalon(who, salon, { day, time, service = "کراتین مو", extra = {}, headers } = {}) {
  return who.client.post("/api/salon-bookings", {
    salonUserId: salon.user.id,
    service,
    bookingDate: day,
    time,
    client: who.user.name,
    phone: who.phone,
    ...extra
  }, headers ? { headers } : undefined);
}

export async function smsRows({ phone, purpose } = {}) {
  await connected;
  const where = [];
  const params = [];
  if (phone) { params.push(phone); where.push(`phone = $${params.length}`); }
  if (purpose) { params.push(purpose); where.push(`purpose = $${params.length}`); }
  const { rows } = await db.query(`SELECT id, phone, purpose, body, status FROM sms_log ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id`, params);
  return rows;
}

/** SMS are fire-and-forget: wait until the count stops growing. */
export async function settledSmsCount(filter, waitMs = 1500) {
  let last = -1;
  let rows = await smsRows(filter);
  const deadline = Date.now() + 6000;
  while (rows.length !== last && Date.now() < deadline) {
    last = rows.length;
    await new Promise((r) => setTimeout(r, waitMs));
    rows = await smsRows(filter);
  }
  return rows.length;
}

export { createClient, registerUser, futureBookingDay, TEST_BASE_URL };
