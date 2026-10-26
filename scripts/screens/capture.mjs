#!/usr/bin/env node
/**
 * Screenshots of every screen people see, for design and copy reviews (docs/screens/README.md).
 *
 * It needs a running app on an EMPTY database (sample people are created through the real API) and a
 * Chromium for Playwright. One run writes docs/screens/<role>/<id>.jpg and docs/screens/index.json
 * (title, role and the visible text of each screen), replacing the old files of the screens it takes.
 *
 *   node scripts/screens/capture.mjs                     # every screen, app at http://localhost:3100
 *   node scripts/screens/capture.mjs salon-home c-sheet  # only these ids (the app must hold the sample people)
 *
 * Env: SCREENS_BASE_URL (default http://localhost:3100), SCREENS_CHROMIUM (a Chromium binary when Playwright's
 * own is missing). The sample people and their passwords are fixed below; never run this against real data.
 */
import { dateKeyAfter } from "../../app/shared/lib/artistPlace.js";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

const BASE = process.env.SCREENS_BASE_URL || "http://localhost:3100";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "docs/screens");
const PASSWORD = "screens-pass-123";
const PEOPLE = {
  salon: { phone: "09121111111", type: "salon", name: "سالن رز" },
  artist: { phone: "09122222222", type: "artist", name: "نگار کاشی" },
  artist2: { phone: "09123333333", type: "artist", name: "مینا میکاپ" },
  client: { phone: "09124444444", type: "client", name: "سارا احمدی" },
  client2: { phone: "09125555555", type: "client", name: "مریم رضایی" }
};

function api(cookie = "") {
  const request = async (route, method, body) => {
    const res = await fetch(BASE + route, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const payload = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, payload };
  };
  return { cookie: () => cookie, get: (r) => request(r, "GET"), post: (r, b) => request(r, "POST", b), patch: (r, b) => request(r, "PATCH", b), put: (r, b) => request(r, "PUT", b) };
}

/** An open (non-Friday) day `n` open days from today, as the API's date key. */
function openDay(n) {
  const day = new Date();
  for (let found = 0; found < n;) {
    day.setDate(day.getDate() + 1);
    if (getPersianWeekday(day) !== "جمعه") found += 1;
  }
  return formatPersianDateKey(day);
}

/** Log everyone in; on an empty database create them first with a salon, a team artist, services and bookings. */
async function people() {
  const sessions = {};
  const ids = {};
  for (const [key, person] of Object.entries(PEOPLE)) {
    const client = api();
    let res = await client.post("/api/auth/login", { phone: person.phone, password: PASSWORD });
    if (!res.ok) res = await client.post("/api/auth/register", { phone: person.phone, password: PASSWORD, type: person.type, name: person.name });
    if (!res.ok) throw new Error(`${key}: ${JSON.stringify(res.payload)} (use an empty database)`);
    sessions[key] = client;
    ids[key] = res.payload.data?.user?.id;
  }
  const { salon, artist, artist2, client, client2 } = sessions;
  const services = (await salon.get("/api/salon-services")).payload.data?.services || [];
  if (!services.length) {
    await salon.get("/api/salon-hours");
    for (const [name, price, duration] of [["کوتاهی مو", "350000", "۴۵ دقیقه"], ["رنگ مو", "1200000", "۱۲۰ دقیقه"], ["مانیکور", "400000", "۶۰ دقیقه"], ["براشینگ", "250000", "۳۰ دقیقه"]]) {
      await salon.post("/api/salon-services", { name, price, duration });
    }
    for (const [name, price, duration] of [["کاشت ناخن", "800000", "۹۰ دقیقه"], ["لاک ژل", "450000", "۶۰ دقیقه"]]) await artist.post("/api/artist/me", { name, price, duration });
    await artist2.post("/api/artist/me", { name: "میکاپ عروس", price: "5000000", duration: "۱۸۰ دقیقه" });
    const code = (await salon.get("/api/salon-invites/join-code")).payload.data?.code;
    await artist.post("/api/artist/join-salon", { salonUserId: ids.salon, code });
    for (const who of [client, client2]) {
      await who.post("/api/follows", { targetUserId: ids.salon, follow: true });
      await who.post("/api/follows", { targetUserId: ids.artist, follow: true });
    }
    const book = (who, name, phone, service, date, time) => who.post("/api/salon-bookings", { salonUserId: ids.salon, service, bookingDate: date, time, client: name, phone });
    const confirmed = await book(client, PEOPLE.client.name, PEOPLE.client.phone, "کوتاهی مو", openDay(1), "۱۰:۰۰");
    await book(client, PEOPLE.client.name, PEOPLE.client.phone, "رنگ مو", openDay(2), "۱۴:۰۰");
    await book(client2, PEOPLE.client2.name, PEOPLE.client2.phone, "مانیکور", openDay(1), "۱۲:۰۰");
    const cancelled = await book(client2, PEOPLE.client2.name, PEOPLE.client2.phone, "براشینگ", openDay(3), "۱۱:۰۰");
    if (confirmed.ok) await salon.patch("/api/salon-bookings", { id: confirmed.payload.data.booking.id, status: "تایید شده" });
    if (cancelled.ok) await salon.patch("/api/salon-bookings", { id: cancelled.payload.data.booking.id, status: "لغو" });
  }
  return { sessions, ids };
}

/* ---------- the screens ---------- */
// Each screen: id, role (whose session; "guest" for none), title (Persian, what it is), and how to get there.
// Helpers keep the steps short; a step that fails is logged and the screen is still taken as it stands.
const tab = (i) => async (p) => { await p.locator("nav.bottomNav > button").nth(i).click(); await p.waitForTimeout(900); };
// force: a top-of-screen notice can sit over a button for a few seconds; a screenshot run does not wait it out.
const tap = (name, opts = {}) => async (p) => { await p.getByRole("button", { name, ...opts }).first().click({ timeout: 4000, force: true }); await p.waitForTimeout(900); };
const text = (t) => async (p) => { await p.getByText(t, { exact: true }).first().click({ timeout: 4000 }); await p.waitForTimeout(900); };
const css = (selector, hasText) => async (p) => { await p.locator(selector, hasText ? { hasText } : {}).first().click({ timeout: 4000 }); await p.waitForTimeout(900); };
const fill = (selector, value) => async (p) => { await p.locator(selector).fill(value, { timeout: 4000 }); };
/** Two posts of نگار's (made once), so her card on سالن رز's page has pictures. */
async function artistPosts({ sessions }) {
  const mine = (await sessions.artist.get("/api/posts")).payload?.data?.posts || [];
  if (mine.length) return;
  for (const [file, title, tag] of [["nails-chrome.webp", "ناخن کروم", "ناخن"], ["brow-lash.webp", "لیفت مژه", "ابرو و مژه"]]) {
    const image = `data:image/webp;base64,${(await fs.promises.readFile(new URL(`../../public/brand/photos/${file}`, import.meta.url))).toString("base64")}`;
    await sessions.artist.post("/api/posts", { title, tag, image });
  }
}
const salonPath = (ids) => `/salons/${ids.salon}`;
const artistPath = (ids) => `/artists/${ids.artist}`;

/* ---------- where an artist on a salon team receives clients (state is set through the real API) ---------- */
const COLLAB = css(".profileModeRail button, [role=tab], button", "همکاری");
const SALON_LOCATION = { area: "تهران، خیابان گلستان", addressDetail: "پلاک ۱۲، طبقه ۲", geo: { lat: 35.7219, lng: 51.3347 } };

/** Sets the world: the salon with an address, where the artist's clients go (`at`: "salon", "second" or null for their own
 *  place, from today; `next`: the same, from a week later) and the salon's switch. */
function placeState({ at = null, next, switchOn = true } = {}) {
  return async ({ sessions, ids }) => {
    const { salon, artist } = sessions;
    const idOf = (item) => (item === "salon" ? ids.salon : item === "second" ? ids.salon2 : null);
    await salon.post("/api/profile", { data: SALON_LOCATION });
    const staff = (await salon.get("/api/salon-staff")).payload.data.staff.find((person) => person.artist_user_id);
    await salon.patch("/api/salon-staff", { id: staff.id, directAllowed: true });
    await artist.put("/api/artist/place", { salonId: idOf(at), startsOn: dateKeyAfter(0), moveBookings: true });
    if (next !== undefined) await artist.put("/api/artist/place", { salonId: idOf(next), startsOn: dateKeyAfter(7), moveBookings: false });
    if (!switchOn) await salon.patch("/api/salon-staff", { id: staff.id, directAllowed: false });
  };
}

/** A second salon (made on first use) the artist has joined, for the screens that show two of them. */
async function withSecondSalon(ctx) {
  const { sessions, ids } = ctx;
  if (ids.salon2) return;
  const client = api();
  let res = await client.post("/api/auth/login", { phone: "09126666666", password: PASSWORD });
  if (!res.ok) res = await client.post("/api/auth/register", { phone: "09126666666", password: PASSWORD, type: "salon", name: "سالن نیلوفر" });
  sessions.salon2 = client;
  ids.salon2 = res.payload.data?.user?.id;
  await client.get("/api/salon-hours");
  const code = (await client.get("/api/salon-invites/join-code")).payload.data?.code;
  await sessions.artist.post("/api/artist/join-salon", { salonUserId: ids.salon2, code });
}

/** The client opens the artist's page in the app, picks the first service and goes to the day and hour sheet. */
const openBooker = async (p) => {
  await p.locator("button.sduItem").first().click({ timeout: 6000 });
  await p.waitForTimeout(400);
  await p.locator(".sduPanel button", { hasText: "رزرو" }).last().click({ timeout: 4000, force: true });
  await p.waitForTimeout(1500);
};
const scrollTo = (selector) => async (p) => { await p.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 8000 }); await p.waitForTimeout(500); };

function placeScreens() {
  const artistOpen = (ids) => `/?open=artist-${ids.artist}`;
  const direct = async (ctx) => { await placeState({ at: "salon" })(ctx); await makeDirectBooking(ctx); };
  const staffSheet = [css(".profileModeRail button, [role=tab], button", "پرسنل"), tap(/^مدیریت نگار/), scrollTo(".plSwitchRow")];
  // Tomorrow: one of نگار's own clients at her own place (18:30), then she works at سالن رز and one comes there (13:30).
  const teamDay = async (ctx) => {
    await placeState({})(ctx);
    const { client2 } = ctx.sessions;
    await client2.post("/api/artist/bookings", { artistUserId: ctx.ids.artist, service: "لاک ژل", bookingDate: dateKeyAfter(1), time: "۱۸:۳۰" });
    await placeState({ at: "salon" })(ctx);
    await ctx.sessions.client.post("/api/artist/bookings", { artistUserId: ctx.ids.artist, service: "لاک ژل", bookingDate: dateKeyAfter(1), time: "۱۳:۳۰" });
  };
  // نگار at her own place with one of her clients tomorrow, before she turns سالن رز on.
  const switchList = async (ctx) => {
    await placeState({})(ctx);
    await ctx.sessions.client.post("/api/artist/bookings", { artistUserId: ctx.ids.artist, service: "لاک ژل", bookingDate: dateKeyAfter(1), time: "۱۵:۰۰" });
  };
  const turnOn = async (p) => { await p.getByRole("switch", { name: /^مشتری‌های خودت میان/ }).first().click({ timeout: 4000 }); await p.waitForTimeout(900); };
  return [
    { id: "artist-place-own", role: "artist", title: "همکاری، کارت سالن، مشتری‌ها میان جای خودش", setup: placeState({}), steps: [COLLAB], full: true },
    { id: "artist-place-here", role: "artist", title: "همکاری، کارت سالن، الان اینجا کار می‌کنه", setup: placeState({ at: "salon" }), steps: [COLLAB], full: true },
    { id: "artist-place-switch", role: "artist", title: "برگهٔ «مشتری‌هات از کی بیان …؟»", setup: placeState({}), steps: [COLLAB, turnOn] },
    { id: "artist-place-switch-list", role: "artist", title: "برگهٔ «این نوبت هم بیاد …؟» با نوبت‌هایی که جابه‌جا می‌شن", setup: switchList, steps: [COLLAB, turnOn, tap("ادامه"), async (p) => { await p.waitForTimeout(6000); }] },
    { id: "artist-place-blocked", role: "artist", title: "سالن مشتری‌های خودش رو بسته", setup: placeState({ at: "salon", switchOn: false }), steps: [COLLAB], full: true },
    { id: "artist-place-dark", role: "artist", title: "همکاری، کارت سالن، شب", dark: true, setup: placeState({ at: "salon" }), steps: [COLLAB], full: true },
    { id: "client-artist-book-place", role: "client", title: "نوبت از آرتیست، «کجا» سالن رو می‌گه", setup: placeState({ at: "salon" }), path: artistOpen, steps: [openBooker] },
    { id: "client-artist-booking-place", role: "client", title: "جزئیات نوبت آرتیست توی سالن", setup: direct, steps: [tap(/لاک ژل/)] },
    { id: "salon-staff-direct-switch", role: "salon", title: "مدیریت آرتیست، کلید نوبت مستقیم", setup: direct, steps: staffSheet },
    { id: "salon-staff-direct-off", role: "salon", title: "مدیریت آرتیست، نوبت مستقیم بسته", setup: placeState({ at: "salon", switchOn: false }), steps: staffSheet },
    { id: "salon-day-team-client", role: "salon", title: "برنامهٔ فردای سالن با «مشتری نگار» و «نگار سرش شلوغه»", setup: teamDay, steps: [tap("روز بعد"), async (p) => { await p.locator(".plTeamRow").first().waitFor({ timeout: 35000 }).catch(() => {}); }, scrollTo(".todayScheduleList")] },
    // Last: the second salon stays in the sample database from here on.
    { id: "artist-place-two", role: "artist", title: "دو سالن، کارت‌های کشویی، جابه‌جایی از هفتهٔ بعد", setup: async (ctx) => { await withSecondSalon(ctx); await placeState({ at: "salon", next: "second" })(ctx); }, steps: [COLLAB], full: true }
  ];
}

/** The client books the artist straight from their page on the first day she receives at the salon. */
async function makeDirectBooking({ sessions, ids }) {
  const { client, artist } = sessions;
  for (let n = 1; n <= 14; n += 1) {
    const day = new Date();
    day.setDate(day.getDate() + n);
    if (getPersianWeekday(day) !== "شنبه" && getPersianWeekday(day) !== "دوشنبه") continue;
    const made = await client.post("/api/artist/bookings", { artistUserId: ids.artist, service: "لاک ژل", bookingDate: formatPersianDateKey(day), time: "۱۶:۰۰" });
    if (!made.ok) continue; // the artist is busy then (the sample salon booking): try the next salon day
    await artist.patch("/api/artist/me", { kind: "booking", id: made.payload.data.booking.id, status: "تایید شده" });
    return;
  }
}

/** The «کجا» card in the booking details opens the map sheet; the tiles get a moment to load. */
const openMap = async (p) => { await p.locator(".locCard.is-pinned").first().click({ timeout: 6000 }); await p.waitForTimeout(2500); };

const SCREENS = [
  // guest
  { id: "guest-welcome", role: "guest", title: "صفحهٔ اول، انتخاب نقش" },
  { id: "guest-signup-client", role: "guest", title: "ثبت‌نام مشتری، قدم شماره", steps: [text("مشتری")] },
  { id: "guest-signup-salon", role: "guest", title: "ثبت‌نام سالن", steps: [text("سالن")] },
  { id: "guest-signup-salon-errors", role: "guest", title: "ثبت‌نام سالن با خانه‌های خالی", steps: [text("سالن"), tap("بساز")] },
  { id: "guest-signup-artist", role: "guest", title: "ثبت‌نام آرتیست", steps: [text("آرتیست")] },
  { id: "guest-login", role: "guest", title: "ورود", steps: [async (p) => { await p.getByRole("button", { name: "ورود" }).last().click(); await p.waitForTimeout(900); }] },
  { id: "guest-from-salon-link", role: "guest", title: "مهمانی که با لینک سالن آمده", path: (ids) => `/?open=salon-${ids.salon}` },
  { id: "guest-salon-page", role: "guest", title: "صفحهٔ عمومی سالن", path: salonPath },
  { id: "guest-salon-page-full", role: "guest", title: "صفحهٔ عمومی سالن، کامل", path: salonPath, full: true },
  { id: "guest-salon-team-sheet", role: "guest", title: "برگهٔ آرتیست تیم در صفحهٔ سالن", setup: artistPosts, path: salonPath, steps: [css(".stmCard", "نگار کاشی")] },
  { id: "guest-artist-page", role: "guest", title: "صفحهٔ عمومی آرتیست", path: artistPath },
  { id: "guest-not-found", role: "guest", title: "صفحه پیدا نشد", path: () => "/no-such-page" },
  { id: "guest-terms", role: "guest", title: "قوانین", path: () => "/terms" },
  { id: "guest-privacy", role: "guest", title: "حریم خصوصی", path: () => "/privacy" },
  { id: "guest-about-desktop", role: "guest", title: "صفحهٔ معرفی روی کامپیوتر", desktop: true, full: true },
  // client
  { id: "client-home", role: "client", title: "خانهٔ مشتری" },
  { id: "client-home-full", role: "client", title: "خانهٔ مشتری، کامل", full: true },
  { id: "client-notifications", role: "client", title: "اعلان‌های مشتری", steps: [tap("اعلان‌ها")] },
  { id: "client-support", role: "client", title: "پشتیبانی", steps: [tap(/^پشتیبانی/)] },
  { id: "client-history", role: "client", title: "نوبت‌های قبلی", steps: [tap(/نوبت‌های قبلی/)] },
  { id: "client-booking-confirmed", role: "client", title: "جزئیات نوبت تأییدشده", steps: [tap(/^سالن رز، کوتاهی مو/)] },
  { id: "client-booking-pending", role: "client", title: "جزئیات درخواست در انتظار", steps: [tap(/^سالن رز، رنگ مو/)] },
  { id: "client-booking-map", role: "client", title: "«کجا» روی نقشه، از جزئیات نوبت", steps: [tap(/^سالن رز، کوتاهی مو/), openMap] },
  { id: "client-booking-map-dark", role: "client", title: "«کجا» روی نقشه، شب", dark: true, steps: [tap(/^سالن رز، کوتاهی مو/), openMap] },
  { id: "client-category-nails", role: "client", title: "دسته‌بندی ناخن", steps: [css(".cnCat", "ناخن")] },
  { id: "client-category-empty", role: "client", title: "دسته‌بندی بدون سالن", steps: [css(".cnCat", "ابرو")] },
  { id: "client-my-code", role: "client", title: "کد من", steps: [tap("کد من")] },
  { id: "client-book-tab", role: "client", title: "تب رزرو، سالن و آرتیست من", steps: [tab(2)] },
  { id: "client-find-tab", role: "client", title: "تب رزرو، پیدا کردن", steps: [tab(2), async (p) => { await p.getByRole("tab", { name: "پیدا کردن" }).click(); await p.waitForTimeout(900); }] },
  { id: "client-salon-sheet", role: "client", title: "برگهٔ خدمات سالن با یک خدمت انتخاب‌شده", steps: [tab(2), async (p) => { await p.locator("button", { hasText: "رنگ مو" }).filter({ hasText: "رزرو" }).first().click(); await p.waitForTimeout(1200); }] },
  { id: "client-booker", role: "client", title: "انتخاب روز و ساعت", steps: [tab(2), async (p) => { await p.locator("button", { hasText: "رنگ مو" }).filter({ hasText: "رزرو" }).first().click(); await p.waitForTimeout(1200); await p.locator("button", { hasText: "رزرو «رنگ مو»" }).click(); await p.waitForTimeout(1500); }] },
  { id: "client-multi-service", role: "client", title: "چند خدمت در یک نوبت", steps: [tab(2), text("چند کار با هم، توی یه نوبت")] },
  { id: "client-settings", role: "client", title: "تنظیمات مشتری", steps: [tab(0)] },
  { id: "client-settings-full", role: "client", title: "تنظیمات مشتری، کامل", steps: [tab(0)], full: true },
  { id: "client-edit-profile", role: "client", title: "ویرایش پروفایل", steps: [tab(0), tap(/ویرایش/)] },
  { id: "client-location", role: "client", title: "جام روی نقشه", steps: [tab(0), text("جام روی نقشه")] },
  { id: "client-saved", role: "client", title: "ذخیره‌شده‌ها", steps: [tab(0), text("ذخیره‌شده‌ها")] },
  // salon (its requests open by themselves on arrival; most screens close them first)
  { id: "salon-request-on-open", role: "salon", title: "درخواست تازه که با باز شدن اپ می‌آید", keepDialogs: true },
  { id: "salon-home", role: "salon", title: "خانهٔ سالن" },
  { id: "salon-notifications", role: "salon", title: "اعلان‌های سالن", steps: [tap("اعلان‌ها")] },
  { id: "salon-qr", role: "salon", title: "کد QR سالن", steps: [tap("کد QR و اسکن")] },
  { id: "salon-tomorrow", role: "salon", title: "نوبت‌های فردا", steps: [tap("روز بعد")] },
  { id: "salon-calendar", role: "salon", title: "تقویم نوبت‌ها", steps: [tap(/باز کردن تقویم/)] },
  { id: "salon-services", role: "salon", title: "خدمات سالن", steps: [css(".profileModeRail button, [role=tab], button", "خدمات")] },
  { id: "salon-add-service", role: "salon", title: "افزودن خدمت", steps: [css(".profileModeRail button, [role=tab], button", "خدمات"), tap(/افزودن/)] },
  { id: "salon-portfolio", role: "salon", title: "نمونه‌کار سالن", steps: [css(".profileModeRail button, [role=tab], button", "نمونه‌کار")] },
  { id: "salon-staff", role: "salon", title: "پرسنل", steps: [css(".profileModeRail button, [role=tab], button", "پرسنل")] },
  { id: "salon-complete-profile", role: "salon", title: "تکمیل پروفایل", steps: [tap("بریم")] },
  { id: "salon-create-1-who", role: "salon", title: "ثبت نوبت، مشتری", steps: [css("button.is-createBooking")] },
  { id: "salon-create-2-service", role: "salon", title: "ثبت نوبت، خدمت", steps: [css("button.is-createBooking"), fill("#vb-name", "لیلا"), css(".vbSubmit"), css(".vbService")] },
  { id: "salon-create-3-day", role: "salon", title: "ثبت نوبت، روز", steps: [css("button.is-createBooking"), fill("#vb-name", "لیلا"), css(".vbSubmit"), css(".vbService"), css(".vbSubmit")] },
  { id: "salon-create-4-time", role: "salon", title: "ثبت نوبت، ساعت", steps: [css("button.is-createBooking"), fill("#vb-name", "لیلا"), css(".vbSubmit"), css(".vbService"), css(".vbSubmit"), async (p) => { await p.locator(".vbDay").nth(1).click(); await p.waitForTimeout(1200); }] },
  { id: "salon-create-5-ready", role: "salon", title: "ثبت نوبت، آماده", steps: [css("button.is-createBooking"), fill("#vb-name", "لیلا"), css(".vbSubmit"), css(".vbService"), css(".vbSubmit"), async (p) => { await p.locator(".vbDay").nth(1).click(); await p.waitForTimeout(1200); }, css(".vbTime")] },
  { id: "salon-customers", role: "salon", title: "مشتریان", steps: [tab(2)] },
  { id: "salon-invite-clients", role: "salon", title: "دعوت مشتری", steps: [tab(2), tap(/دعوت مشتری/)] },
  { id: "salon-settings", role: "salon", title: "تنظیمات سالن", steps: [tab(0)] },
  { id: "salon-settings-full", role: "salon", title: "تنظیمات سالن، کامل", steps: [tab(0)], full: true },
  { id: "salon-hours", role: "salon", title: "ساعت کاری سالن", steps: [tab(0), css(".settingsSalonHoursToggle")] },
  { id: "salon-hours-day", role: "salon", title: "ساعت کاری سالن، یک روز باز", steps: [tab(0), css(".settingsSalonHoursToggle"), css(".hrsDayMain", "دوشنبه")] },
  { id: "salon-public-preview", role: "salon", title: "پیش‌نمایش صفحهٔ عمومی", steps: [tap("صفحه‌م رو مثل مشتری ببینم")] },
  // artist
  { id: "artist-home", role: "artist", title: "خانهٔ آرتیست" },
  { id: "artist-tomorrow", role: "artist", title: "نوبت‌های فردای آرتیست", steps: [tap("روز بعد")] },
  { id: "artist-break", role: "artist", title: "تایم استراحت", steps: [tap(/تایم استراحت/)] },
  { id: "artist-notifications", role: "artist", title: "اعلان‌های آرتیست", steps: [tap("اعلان‌ها")] },
  { id: "artist-services", role: "artist", title: "خدمات آرتیست", steps: [css(".profileModeRail button, [role=tab], button", "خدمات")] },
  { id: "artist-collab", role: "artist", title: "همکاری با سالن", steps: [css(".profileModeRail button, [role=tab], button", "همکاری")] },
  { id: "artist-customers", role: "artist", title: "مشتریان آرتیست", steps: [tab(2)] },
  { id: "artist-settings", role: "artist", title: "تنظیمات آرتیست", steps: [tab(0)] },
  // where an artist on a salon team receives the clients who book them directly (owner's idea of 2026-10-24).
  // Each screen sets the state it shows first (the choice, the salon's switch, an address), so the order does not matter.
  ...placeScreens()
];

async function closeArrivalDialogs(page) {
  for (let k = 0; k < 3; k += 1) {
    const close = page.locator(".sbmScreen button", { hasText: "بستن" });
    if (!(await close.count())) break;
    await close.first().click().catch(() => {});
    await page.waitForTimeout(700);
  }
}

async function main() {
  const only = new Set(process.argv.slice(2));
  const { sessions, ids } = await people();
  const browser = await chromium.launch(process.env.SCREENS_CHROMIUM ? { executablePath: process.env.SCREENS_CHROMIUM } : {});
  const indexFile = path.join(OUT, "index.json");
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : { screens: {} };
  for (const screen of SCREENS) {
    if (only.size && !only.has(screen.id)) continue;
    // A screen may set up the state it shows (the choice, a switch, an address) through the real API first.
    if (screen.setup) await screen.setup({ sessions, ids });
    const context = await browser.newContext(screen.desktop
      ? { viewport: { width: 1366, height: 820 }, locale: "fa-IR", ...(screen.dark ? { colorScheme: "dark" } : {}) }
      : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, locale: "fa-IR", isMobile: true, hasTouch: true, ...(screen.dark ? { colorScheme: "dark" } : {}) });
    // Phones skip the about page; the one-time «+» tip counts as seen so it does not cover the screens.
    await context.addInitScript({ content: `try { ${screen.desktop ? "" : 'localStorage.setItem("frfro-entered", "1");'} const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith("frfro-tip") || k === "frfro-due-later" ? "1" : g.call(this, k); }; } catch (e) {}` });
    if (screen.role !== "guest") {
      const [name, ...rest] = sessions[screen.role].cookie().split("=");
      await context.addCookies([{ name, value: rest.join("="), url: BASE }]);
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(BASE + (screen.path ? screen.path(ids) : "/"), { waitUntil: "load" });
    await page.waitForTimeout(2500);
    if (!screen.keepDialogs) await closeArrivalDialogs(page);
    for (const step of screen.steps || []) {
      try { await step(page); } catch (error) { errors.push(`step: ${error.message.split("\n")[0]}`); }
    }
    await page.waitForTimeout(900);
    const dir = path.join(OUT, screen.role);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${screen.id}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 72, fullPage: Boolean(screen.full) });
    const visible = (await page.locator("body").innerText()).split("\n").map((line) => line.trim()).filter(Boolean);
    index.screens[screen.id] = { role: screen.role, title: screen.title, file: path.relative(OUT, file), takenAt: new Date().toISOString().slice(0, 10), text: [...new Set(visible)], problems: errors };
    console.log(`${screen.id}${errors.length ? `  (${errors.length} problem${errors.length > 1 ? "s" : ""}: ${errors[0].slice(0, 90)})` : ""}`);
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 1)}\n`);
}

main().catch((error) => { console.error(error); process.exit(1); });
