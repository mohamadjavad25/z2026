#!/usr/bin/env node
/**
 * Sample salons, an artist and a client for the store pictures (scripts/store/README.md), made through the real API.
 * Run only against an EMPTY throwaway database; the names are made up (owner's rule, 2026-11-05).
 *
 *   STORE_BASE_URL=http://localhost:3300 node scripts/store/seed.mjs
 */
import fs from "node:fs";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

export const BASE = process.env.STORE_BASE_URL || "http://localhost:3300";
export const PASSWORD = "store-pass-123";
export const PEOPLE = {
  rose: { phone: "09131111111", type: "salon", name: "رز سپید" },
  gisoo: { phone: "09132222222", type: "salon", name: "آتلیه گیسو" },
  sara: { phone: "09133333333", type: "artist", name: "سارا" },
  client: { phone: "09134444444", type: "client", name: "مریم" },
  client2: { phone: "09135555555", type: "client", name: "رها" }
};

const art = (file) => new URL(`../../docs/brand/demo-profiles/${file}`, import.meta.url);
const dataUrl = (file) => `data:image/${file.endsWith(".png") ? "png" : "jpeg"};base64,${fs.readFileSync(art(file)).toString("base64")}`;

export function api(cookie = "") {
  const request = async (route, method, body) => {
    const res = await fetch(BASE + route, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) console.log(`  ${method} ${route}: ${res.status} ${JSON.stringify(payload).slice(0, 120)}`);
    return { ok: res.ok, status: res.status, payload };
  };
  return { cookie: () => cookie, get: (r) => request(r, "GET"), post: (r, b) => request(r, "POST", b), patch: (r, b) => request(r, "PATCH", b), put: (r, b) => request(r, "PUT", b) };
}

/** An open (non-Friday) day `n` open days from today, as the API's date key. */
export function openDay(n) {
  const day = new Date();
  for (let found = 0; found < n;) {
    day.setDate(day.getDate() + 1);
    if (getPersianWeekday(day) !== "جمعه") found += 1;
  }
  return formatPersianDateKey(day);
}

/** Logs everyone in; on an empty database makes the whole sample world first. */
export async function people() {
  const sessions = {};
  const ids = {};
  let fresh = false;
  for (const [key, person] of Object.entries(PEOPLE)) {
    const who = api();
    let res = await who.post("/api/auth/login", { phone: person.phone, password: PASSWORD });
    if (!res.ok) { res = await who.post("/api/auth/register", { phone: person.phone, password: PASSWORD, type: person.type, name: person.name }); fresh = true; }
    if (!res.ok) throw new Error(`${key}: ${JSON.stringify(res.payload)} (use an empty database)`);
    sessions[key] = who;
    ids[key] = res.payload.data?.user?.id;
  }
  if (fresh) await world(sessions, ids);
  return { sessions, ids };
}

async function world(sessions, ids) {
  const { rose, gisoo, sara, client, client2 } = sessions;
  for (const who of [rose, gisoo, sara, client, client2]) await who.post("/api/welcome-survey", { action: "later" });
  await rose.post("/api/profile", { data: { avatar: dataUrl("salon-logo.png"), poster: dataUrl("salon-poster.jpg"), service: "مو و آرایش", area: "تهران، ونک", addressDetail: "خیابان ملاصدرا، پلاک ۱۲، طبقه ۲", geo: { lat: 35.7579, lng: 51.4103 } } });
  await gisoo.post("/api/profile", { data: { service: "مو", area: "تهران، پونک" } });
  await sara.post("/api/profile", { data: { avatar: dataUrl("artist-logo.png"), poster: dataUrl("artist-poster.jpg"), service: "تتو و پیرسینگ", area: "تهران، سعادت‌آباد" } });
  await rose.get("/api/salon-hours");
  await gisoo.get("/api/salon-hours");
  for (const [name, price, duration] of [["کوتاهی مو", "450000", "۴۵ دقیقه"], ["رنگ مو", "1800000", "۱۲۰ دقیقه"], ["براشینگ", "350000", "۳۰ دقیقه"], ["میکاپ", "2500000", "۹۰ دقیقه"]]) {
    await rose.post("/api/salon-services", { name, price, duration });
  }
  for (const [name, price, duration] of [["کاشت ناخن", "900000", "۱۲۰ دقیقه"], ["ژلیش", "450000", "۶۰ دقیقه"], ["پدیکور", "550000", "۶۰ دقیقه"]]) {
    await gisoo.post("/api/salon-services", { name, price, duration });
  }
  for (const [name, price, duration] of [["تتو", "3000000", "۱۲۰ دقیقه"], ["پیرسینگ", "800000", "۳۰ دقیقه"]]) await sara.post("/api/artist/me", { name, price, duration });
  for (const [file, title, tag] of [["salon-post1.jpg", "رنگ مو", "مو"], ["salon-post2.jpg", "شینیون", "مو"], ["../../../scripts/screens/samples/work-2.jpg", "ژلیش", "ناخن"]]) {
    await rose.post("/api/salon-portfolio", { title, tag, image: dataUrl(file) });
  }
  for (const [file, title, tag] of [["artist-post2.jpg", "تتو", "تتو"], ["artist-post1.jpg", "پیرسینگ", "تتو"]]) await sara.post("/api/posts", { title, tag, image: dataUrl(file) });
  for (const who of [client, client2]) {
    for (const target of [ids.rose, ids.gisoo, ids.sara]) await who.post("/api/follows", { targetUserId: target, follow: true });
  }
  const book = (who, person, salonId, service, date, time) => who.post("/api/salon-bookings", { salonUserId: salonId, service, bookingDate: date, time, client: person.name, phone: person.phone });
  const confirmed = await book(client, PEOPLE.client, ids.rose, "کوتاهی مو", openDay(1), "۱۱:۰۰");
  await book(client, PEOPLE.client, ids.gisoo, "ژلیش", openDay(3), "۱۶:۰۰");
  const first = await book(client2, PEOPLE.client2, ids.rose, "براشینگ", openDay(1), "۱۰:۰۰");
  if (first.ok) await rose.patch("/api/salon-bookings", { id: first.payload.data.booking.id, status: "تایید شده" });
  const second = await book(client2, PEOPLE.client2, ids.rose, "رنگ مو", openDay(1), "۱۴:۰۰");
  if (confirmed.ok) await rose.patch("/api/salon-bookings", { id: confirmed.payload.data.booking.id, status: "تایید شده" });
  if (second.ok) await rose.patch("/api/salon-bookings", { id: second.payload.data.booking.id, status: "تایید شده" });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  people().then(({ ids }) => console.log("ready", ids)).catch((error) => { console.error(error); process.exit(1); });
}
