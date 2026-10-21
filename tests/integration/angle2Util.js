import pg from "pg";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { createClient, registerUser } from "./helpers.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

/** Shared helpers of the "angle 2" (time, calendar and data edge cases) chaos tests. Not a test file itself. */

export const note = (...args) => console.log("[angle2]", ...args);

let dbClient = null;
export async function db() {
  if (!dbClient) {
    dbClient = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
    await dbClient.connect();
  }
  return dbClient;
}
export async function q(sql, params = []) {
  return (await (await db()).query(sql, params)).rows;
}
export async function closeDb() {
  if (dbClient) await dbClient.end().catch(() => {});
  dbClient = null;
}

export const DAY_MS = 86_400_000;
export const keyAhead = (days, from = Date.now()) => formatPersianDateKey(new Date(from + days * DAY_MS));
export const weekdayAhead = (days, from = Date.now()) => getPersianWeekday(new Date(from + days * DAY_MS));
export const plain = (s) => String(s).replace(/[\s‌‏‎]/g, "");

/** A day `min`..`max` days ahead that is neither a Friday (closed by default) nor in `exclude` (weekday names). */
export function pickDay({ min = 2, max = 14, exclude = [] } = {}) {
  const skip = new Set(["جمعه", ...exclude].map(plain));
  for (let offset = min; offset <= max; offset += 1) {
    const weekday = weekdayAhead(offset);
    if (!skip.has(plain(weekday))) return { key: keyAhead(offset), offset, weekday };
  }
  throw new Error("no usable day");
}

export async function newSalon(name = "Angle2 Salon") {
  const api = createClient();
  const reg = await registerUser(api, { type: "salon", name, menu: true });
  await api.get("/api/salon-hours");
  return { api, ...reg, id: reg.user.id };
}
export async function newClient(name = "Angle2 Client", opts = {}) {
  const api = createClient();
  const reg = await registerUser(api, { type: "client", name, ...opts });
  return { api, ...reg, id: reg.user.id };
}
export async function newArtist(name = "Angle2 Artist") {
  const api = createClient();
  const reg = await registerUser(api, { type: "artist", name, menu: true });
  return { api, ...reg, id: reg.user.id };
}

/** Raw HTTP call so bodies that JSON.stringify would never produce (garbage, empty, an array) can be sent. */
export async function raw(path, { method = "POST", body, cookie = "", headers = {} } = {}) {
  const res = await fetch(`${TEST_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body
  });
  const text = await res.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, payload, text };
}

export async function cron(path, body, { secret = TEST_CRON_SECRET, rawBody } = {}) {
  return raw(`/api/cron/${path}`, {
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
    headers: secret === null ? {} : { Authorization: `Bearer ${secret}` }
  });
}

export const salonRows = (salonId) => q("SELECT * FROM salon_bookings WHERE salon_user_id = $1 ORDER BY id", [salonId]);
export const artistRows = (artistId) => q("SELECT * FROM artist_bookings WHERE artist_user_id = $1 ORDER BY id", [artistId]);

/** Client POST /api/salon-bookings with sensible defaults. */
export function bookAtSalon(clientApi, salon, client, { day, time = "۱۰:۰۰", service = "کوتاهی مو", ...extra } = {}) {
  return clientApi.post("/api/salon-bookings", {
    salonUserId: salon.id,
    service,
    bookingDate: day,
    time,
    client: client.user.name,
    phone: client.phone,
    ...extra
  });
}

export async function deleteAccount(account) {
  const res = await account.api.delete("/api/profile", { currentPassword: account.password });
  if (!res.ok) throw new Error(`delete account failed: ${res.status} ${JSON.stringify(res.payload)}`);
}
