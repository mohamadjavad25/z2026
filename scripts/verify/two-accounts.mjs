#!/usr/bin/env node
/* global document, NodeFilter */
/**
 * The owner's two-account test (owner's rule, 2026-11-08; CLAUDE.md): drives the real screens with the owner's two
 * phone numbers in one role pair per run, checks each step, and saves a picture of it for the owner to approve.
 *
 *   FRFRO_OWNER_TEST_PHONES=first,second VERIFY_OUT=/some/folder node scripts/verify/two-accounts.mjs salon-client
 *   rounds: salon-client · artist-client · salon-artist · client-salon (the numbers swapped)
 *
 * Needs an app on a THROWAWAY database (accounts are created, one per number) with no real SMS:
 * FRFRO_SMS_PROVIDER=test FRFRO_OTP_REQUIRED=0. It refuses any host but localhost. The numbers come only from the
 * environment, because this repository is public, and every picture has phone numbers blanked out.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3200";
if (!["localhost", "127.0.0.1"].includes(new URL(BASE).hostname)) throw new Error("This test runs only on localhost.");
const phones = String(process.env.FRFRO_OWNER_TEST_PHONES || "").split(",").map((phone) => phone.trim()).filter(Boolean);
if (phones.length !== 2) throw new Error("Set FRFRO_OWNER_TEST_PHONES to the two numbers, comma separated.");
const round = process.argv[2];
const OUT = path.join(process.env.VERIFY_OUT || "verify-out", round);
fs.mkdirSync(OUT, { recursive: true });

const PASSWORD = `verify-${randomBytes(9).toString("hex")}`;
const SALON = "سالن نیلوفر";
const ARTIST = "الهام نوری";
const CLIENT = "پریسا کریمی";
const SERVICE = "کوتاهی مو";
// Made-up third parties, only ever on the throwaway database.
const EXTRA_ARTIST = "09120000001";
const EXTRA_CLIENT = "09120000002";

const fa = (text) => String(text).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[digit]);
const results = [];
let shotNo = 0;

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

async function signUp(phone, type, name) {
  const session = api();
  const res = await session.post("/api/auth/register", { phone, password: PASSWORD, type, name });
  if (!res.ok) throw new Error(`register ${type}: ${res.status} ${JSON.stringify(res.payload)}`);
  await session.post("/api/welcome-survey", { action: "later" });
  return { session, id: res.payload.data.user.id, phone, name, type };
}

/** The first open (non-Friday) day at least two days ahead, so no slot is in the past. */
function targetDay() {
  const day = new Date();
  day.setDate(day.getDate() + 2);
  if (getPersianWeekday(day) === "جمعه") day.setDate(day.getDate() + 1);
  return { key: formatPersianDateKey(day), weekday: getPersianWeekday(day) };
}
const DAY = targetDay();
// The day's card by its weekday, as a whole word: «شنبه» must not pick «پنجشنبه» (it did on a run made on a Wednesday, 2026-11-11).
const DAY_WORD = new RegExp(`(^|[^\u0600-\u06FF])${DAY.weekday}`);

let browser;
async function open(person, { entered = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 820 }, locale: "fa-IR" });
  await context.route((url) => !["localhost", "127.0.0.1"].includes(url.hostname), (route) => route.abort());
  if (entered) await context.addInitScript({ content: 'try { localStorage.setItem("frfro-entered", "1"); sessionStorage.setItem("frfro-due-later", "1"); } catch (e) {}' });
  if (person?.session) {
    const [name, value] = person.session.cookie().split("=");
    await context.addCookies([{ name, value, url: BASE }]);
  }
  const page = await context.newPage();
  await page.addLocatorHandler(page.locator(".onbRoot"), async () => {
    const skip = page.locator(".onbSkip");
    await ((await skip.count()) ? skip : page.locator(".onbNext")).click();
  });
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(message.text())) problems.push(`console: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 500) problems.push(`server ${response.status()}: ${new URL(response.url()).pathname}`); });
  await page.goto(BASE, { waitUntil: "networkidle" });
  return { page, context, problems };
}

/** A picture with every phone number blanked (the check that needed the number has already run). */
async function shot(page, name) {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      node.nodeValue = node.nodeValue.replace(/[0۰][9۹][0-9۰-۹ -]{9,}/g, "۰۹۱۲ ••• ••••");
    }
    document.querySelectorAll("input").forEach((input) => { if (/^[0۰][9۹]/.test(input.value)) input.value = "۰۹۱۲ ••• ••••"; });
  });
  shotNo += 1;
  const file = `${String(shotNo).padStart(2, "0")}-${name}.jpg`;
  await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 80 });
  return file;
}

/** One check: never stops the run; a failure is reported with a picture of where it stopped. */
async function step(title, view, run) {
  const seen = view ? view.problems.length : 0;
  const entry = { title, ok: true, detail: "", shot: null };
  try {
    const out = await run();
    entry.detail = out?.detail || "";
    if (out?.shot) entry.shot = out.shot;
    const fresh = view ? view.problems.slice(seen) : [];
    if (fresh.length) { entry.ok = false; entry.detail = `${entry.detail} | errors: ${fresh.join(" ; ")}`; }
  } catch (error) {
    entry.ok = false;
    entry.detail = String(error.message || error).split("\n")[0].slice(0, 300);
    if (view) entry.shot = await shot(view.page, "failed").catch(() => null);
  }
  results.push(entry);
  console.log(`${entry.ok ? "PASS" : "FAIL"}  ${title}${entry.detail ? `  [${entry.detail}]` : ""}`);
}
const must = (condition, message) => { if (!condition) throw new Error(message); };
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const hide = (phone) => [phone, fa(phone)];
// The site's footer carries frfro's public support line, which can be one of these numbers: that one does not count.
const withoutSupportLine = (text) => text.replace(/tel:\+98\d{10}.{0,30}?[0۰][9۹][0-9۰-۹]{9}/g, "");
const shows = (text, phone) => hide(phone).some((form) => withoutSupportLine(text).includes(form));
const closeBookingScreen = async (page) => {
  const screen = page.locator(".sbmScreen");
  if (await screen.count()) await screen.getByRole("button", { name: "بستن" }).first().click().catch(() => {});
};

async function setHoursSixToMidnight(view, route) {
  const { page } = view;
  await closeBookingScreen(page);
  await page.locator("nav.bottomNav > button").nth(0).click();
  await settle(page);
  await page.locator(".settingsSalonHoursToggle").first().click();
  const row = page.locator(".hrsDay", { has: page.locator(".hrsDayMain", { hasText: new RegExp(`^\\s*${DAY.weekday}`) }) });
  await row.locator(".hrsDayMain").click();
  const grids = row.locator(".hrsGrid");
  await grids.nth(0).locator(".hrsTime").first().click();
  await grids.nth(1).locator(".hrsTime").last().click();
  await settle(page, 300);
  const open = await shot(page, "hours-picked");
  const saved = page.waitForResponse((response) => response.url().includes(route) && response.request().method() !== "GET");
  await page.locator(".hrsSaveBar button").click();
  must((await saved).ok(), "saving the hours failed");
  await settle(page);
  await page.reload({ waitUntil: "networkidle" });
  await closeBookingScreen(page);
  await page.locator("nav.bottomNav > button").nth(0).click();
  await settle(page);
  await page.locator(".settingsSalonHoursToggle").first().click();
  await settle(page);
  const text = await page.locator(".hrsDayMain", { hasText: new RegExp(`^\\s*${DAY.weekday}`) }).innerText();
  must(text.includes("۶ تا ۲۴"), `after reopening it says: ${text.replace(/\s+/g, " ")}`);
  const after = await shot(page, "hours-saved");
  await page.reload({ waitUntil: "networkidle" });
  return { detail: text.replace(/\s+/g, " "), shot: after, open };
}

/** A client on a place's page: what a stranger may and may not see. */
async function placePage(view, kind, id) {
  await view.page.goto(`${BASE}/?open=${kind}-${id}`, { waitUntil: "networkidle" });
  await view.page.locator(".spvBarBook").waitFor();
  await settle(view.page);
}

/** A link opened in the app already opens the service list; otherwise «نوبت بگیر» does. */
async function openServices(page) {
  if (!(await page.locator(".sduItem").first().isVisible())) await page.locator(".spvBarBook").click();
  await page.locator(".sduItem").first().click();
}

/** Booking steps as a client: service → day → the list of hours. */
async function openHours(view) {
  const { page } = view;
  await openServices(page);
  await page.locator(".sduConfirm").click();
  await page.locator(".vbDayCard, .bspDay").filter({ hasText: DAY_WORD }).first().click();
  await page.locator(".vbTime, .bspTime").first().waitFor();
  await settle(page);
  return (await page.locator(".vbTime, .bspTime").allInnerTexts()).map((text) => text.trim());
}

function checkHours(times) {
  must(times[0].includes("۶:۰۰"), `first hour is ${times[0]}`);
  must(times[times.length - 1].includes("۲۳:۰۰"), `last hour is ${times[times.length - 1]}`);
  must(!times.some((time) => time.includes("۲۳:۳۰")), "23:30 is offered for a one-hour service");
}

async function requestAndAnswer(client, provider, placeName, listRoute, listKey) {
  const clientPage = client.view.page;
  await step("مشتری ساعت ۶ صبح رو درخواست می‌ده", client.view, async () => {
    await clientPage.locator(".vbTime, .bspTime").first().click();
    await settle(clientPage);
    const artistForm = await clientPage.locator(".artistBookingPopupConfirm").count();
    if (!artistForm) await clientPage.getByRole("button", { name: /^درخواست نوبت/ }).waitFor();
    const before = await shot(clientPage, "client-ticket");
    await clientPage.locator(artistForm ? ".artistBookingPopupConfirm" : ".vbSubmit").click();
    const receipt = clientPage.locator(".brScreen");
    await receipt.waitFor();
    must((await receipt.innerText()).includes(placeName), "the receipt does not name the place");
    const after = await shot(clientPage, "client-receipt");
    await receipt.getByRole("button", { name: "ببینش توی «نوبت‌هام»" }).click();
    return { shot: after, before };
  });
  await step("درخواست روی صفحهٔ طرف مقابل میاد و تأییدش می‌کنه", provider.view, async () => {
    const page = provider.view.page;
    // A salon already on the app gets the request on its own, and only once: a reload would lose it.
    if (provider.type === "salon") await page.locator(".sbmScreen").waitFor({ timeout: 40_000 }).catch(() => {});
    if (!(await page.locator(".sbmScreen").count())) await page.goto(BASE, { waitUntil: "networkidle" });
    if (provider.type === "artist") {
      // An artist's request waits on «نوبت‌ها», under a notice naming its day.
      await page.locator(".profileModeRail button", { hasText: "نوبت‌ها" }).click();
      await page.locator(".artistBookingsPage .pendingOtherDays button").first().click();
      const card = page.locator(".artistBookingsPage .bkGroup").filter({ hasText: client.name });
      await card.waitFor();
      const seen = await shot(page, "provider-request");
      await card.getByRole("button", { name: "تأیید" }).click();
      await card.waitFor({ state: "detached" });
      return { shot: seen };
    }
    const screen = page.locator(".sbmScreen");
    await screen.waitFor();
    must((await screen.innerText()).includes(client.name), "the client's name is not on the request");
    const approve = screen.getByRole("button", { name: "تأیید", exact: true });
    // Another sheet left open covers the request until it is closed (its × sits bottom-centre): nothing may be lost.
    if (!(await approve.click({ trial: true, timeout: 3000 }).then(() => true, () => false))) {
      await page.mouse.click(195, 778);
      await settle(page);
    }
    const picture = await shot(page, "provider-request");
    await approve.click({ timeout: 8000 });
    await screen.waitFor({ state: "detached" });
    return { shot: picture };
  });
  await step("مشتری تأیید شدن رو می‌بینه و لغو می‌کنه", client.view, async () => {
    await clientPage.goto(BASE, { waitUntil: "networkidle" });
    const card = clientPage.locator(".clientHome .cvCard", { hasText: placeName }).first();
    await card.waitFor();
    must(JSON.stringify((await client.session.get("/api/client-bookings")).payload).includes("تایید شده"), "the booking is not confirmed for the client");
    const confirmed = await shot(clientPage, "client-confirmed");
    await card.click();
    await clientPage.getByRole("button", { name: "لغو نوبت" }).click();
    await clientPage.getByRole("button", { name: "آره، لغو کن" }).click();
    await settle(clientPage, 1200);
    const list = JSON.stringify((await client.session.get("/api/client-bookings")).payload);
    must(list.includes("لغو"), "the booking is not cancelled");
    return { shot: await shot(clientPage, "client-cancelled"), confirmed };
  });
  await step("طرف مقابل لغو شدن رو می‌بینه", provider.view, async () => {
    const rows = (await provider.session.get(listRoute)).payload.data[listKey];
    must(rows.some((row) => row.status === "لغو"), `statuses: ${rows.map((row) => row.status).join(",")}`);
    const page = provider.view.page;
    await page.goto(BASE, { waitUntil: "networkidle" });
    await settle(page);
    return { shot: await shot(page, "provider-after-cancel") };
  });
}

/** Everything the app fetched while `run` went on, to prove a number never reached this phone. */
async function fetched(page, run) {
  const bodies = [];
  const listen = (response) => { if (new URL(response.url()).pathname.startsWith("/api/")) bodies.push(response.text().catch(() => "")); };
  page.on("response", listen);
  await run();
  await settle(page, 1200);
  page.off("response", listen);
  return (await Promise.all(bodies)).join(" ");
}

async function searchPlace(page, name) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator("nav.bottomNav > button").nth(2).click();
  await page.getByRole("tab", { name: "پیدا کردن" }).click();
  await page.locator("#cbt-panel").getByPlaceholder("اسم سالن یا آرتیست").fill(name);
  await page.locator(".cnCard").filter({ hasText: name }).first().waitFor();
}

async function strangerThenConnect(client, provider, kind) {
  const { page } = client.view;
  const pagePath = kind === "salon" ? `/salons/${provider.id}` : `/artists/${provider.id}`;
  await step("مشتری وصل‌نشده دکمهٔ تماس و شماره رو نمی‌بینه", client.view, async () => {
    const seen = await fetched(page, async () => {
      await page.goto(BASE + pagePath, { waitUntil: "networkidle" });
      await settle(page);
    });
    must((await page.locator(".pphCall").count()) === 0, "a call button is showing");
    must(!shows(await page.content(), provider.phone), "the number is in the page");
    must(!shows(seen, provider.phone), "the number reached the phone in a server answer");
    const picture = await shot(page, "stranger-page");
    const route = kind === "salon" ? `/api/salons/${provider.id}` : `/api/artists/${provider.id}`;
    must(!shows(JSON.stringify((await client.session.get(route)).payload), provider.phone), "the number is in the server's answer");
    const search = await fetched(page, () => searchPlace(page, provider.name));
    must(!shows(search, provider.phone), "the number reached the phone from the search");
    return { shot: picture };
  });
  await step("بعد از «وصل شو» و باز کردن دوباره، دکمهٔ تماس میاد", client.view, async () => {
    await page.locator(".cnCard").filter({ hasText: provider.name }).first().getByRole("button", { name: "وصل شو" }).click();
    await page.locator(".spvBarBook").waitFor();
    await settle(page);
    await page.reload({ waitUntil: "networkidle" });
    await placePage(client.view, kind, provider.id);
    await page.locator(".pphCall").waitFor();
    return { shot: await shot(page, "connected-call") };
  });
}

async function pushAndClock(person) {
  await step("روشن کردن اعلان مرورگر خطا نمی‌ده", null, async () => {
    const res = await person.session.post("/api/push/subscribe", { subscription: { endpoint: `https://fcm.googleapis.com/fcm/send/verify-${randomBytes(6).toString("hex")}`, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } } });
    must(res.ok, `${res.status} ${JSON.stringify(res.payload)}`);
    return { detail: "the server stored it; a real Google delivery needs a real phone" };
  });
}

async function wrongClock(person, kind, placeId) {
  const context = await browser.newContext({ viewport: { width: 390, height: 820 }, locale: "fa-IR" });
  await context.route((url) => !["localhost", "127.0.0.1"].includes(url.hostname), (route) => route.abort());
  await context.addInitScript({ content: 'try { localStorage.setItem("frfro-entered", "1"); sessionStorage.setItem("frfro-due-later", "1"); } catch (e) {}' });
  const [name, value] = person.session.cookie().split("=");
  await context.addCookies([{ name, value, url: BASE }]);
  const page = await context.newPage();
  const view = { page, context, problems: [] };
  await step("با تاریخ غلط گوشی (سه روز جلو) «امروز» همون روز واقعی می‌مونه", view, async () => {
    await page.clock.setSystemTime(new Date(Date.now() + 3 * 86400000));
    await page.addLocatorHandler(page.locator(".onbRoot"), async () => { await page.locator(".onbSkip, .onbNext").first().click(); });
    await page.goto(`${BASE}/?open=${kind}-${placeId}`, { waitUntil: "networkidle" });
    await page.locator(".spvBarBook").waitFor();
    await settle(page);
    await openServices(page);
    await page.locator(".sduConfirm").click();
    const first = page.locator(".vbDayCard").first();
    await first.waitFor();
    await settle(page);
    const text = (await first.innerText()).replace(/\s+/g, " ");
    const realToday = getPersianWeekday(new Date());
    must(text.includes("امروز"), `first day reads: ${text}`);
    const second = (await page.locator(".vbDayCard").nth(1).innerText()).replace(/\s+/g, " ");
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    must(second.includes("فردا") || second.includes(getPersianWeekday(tomorrow)), `second day reads: ${second} (today is ${realToday})`);
    return { detail: `${text} / ${second}`, shot: await shot(page, "wrong-clock") };
  });
  await context.close();
}

async function ownEntry(owner) {
  await step("نوبت دستی با اسم ساختگی مشتری ثبت می‌شه", owner.view, async () => {
    const { page } = owner.view;
    await page.goto(BASE, { waitUntil: "networkidle" });
    await closeBookingScreen(page);
    await page.locator("button.is-createBooking").click();
    await page.locator(".visitBookerSheet").waitFor();
    await page.locator("#vb-name").fill("مریم ساختگی");
    await page.locator(".vbSubmit").click();
    await page.locator(".vbService").first().click();
    await page.locator(".vbSubmit").click();
    await page.locator(".vbDayCard, .vbDay").filter({ hasText: DAY_WORD }).first().click();
    await page.locator(".vbTime").nth(2).click();
    await settle(page);
    const before = await shot(page, "own-entry-form");
    await page.locator(".vbSubmit").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    await settle(page);
    const data = owner.type === "artist" ? (await owner.session.get("/api/artist/me")).payload.data.bookings : (await owner.session.get("/api/salon-bookings")).payload.data.bookings;
    const row = data.find((item) => (item.client_name || item.client) === "مریم ساختگی");
    must(row, "the booking is not in the list");
    must(!row.client_user_id, `the booking is tied to account ${row.client_user_id}`);
    return { detail: `client on the booking: ${row.client_name || row.client}`, shot: await shot(page, "own-entry-saved"), before };
  });
}

async function joinTeam(salon, artist, { from = "06:00", to = "24:00", days = "شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه" } = {}) {
  const saved = await salon.session.put("/api/salon-join-terms", { days, from, to, share: 60, allowProposals: true });
  must(saved.ok, `saving the terms ${from}-${to}: ${saved.status} ${JSON.stringify(saved.payload)}`);
  const terms = saved.payload.data?.terms;
  const code = (await salon.session.get("/api/salon-invites/join-code")).payload.data?.code;
  // Two taps at once, as on a slow connection: one card on the team, never two.
  const [first, second] = await Promise.all([1, 2].map(() => artist.session.post("/api/artist/join-salon", { salonUserId: salon.id, code, termsVersion: terms?.version })));
  must(first.ok || second.ok, `join failed: ${first.status} ${JSON.stringify(first.payload)}`);
  const notices = (await salon.session.get("/api/team-notices")).payload.data?.notices || [];
  if (notices.length) await salon.session.post("/api/team-notices", { ids: notices.map((notice) => notice.id) });
}

async function teamTabKeepsNumbers(salon, artist) {
  await step("سالن توی تب پرسنل یه کارت برای آرتیست و شماره‌ش رو می‌بینه", salon.view, async () => {
    const staff = (await salon.session.get("/api/salon-staff")).payload.data.staff.filter((person) => person.artist_user_id === artist.id);
    must(staff.length === 1, `${staff.length} cards for the artist`);
    must(shows(JSON.stringify(staff), artist.phone), "the salon does not get the artist's number");
    const { page } = salon.view;
    await page.goto(BASE, { waitUntil: "networkidle" });
    await closeBookingScreen(page);
    await settle(page);
    await page.locator(".profileModeRail button, [role=tab], button", { hasText: "پرسنل" }).first().click();
    await page.getByRole("button", { name: new RegExp(`^${artist.name}`) }).first().waitFor();
    const list = await shot(page, "team-tab");
    await page.getByRole("button", { name: new RegExp(`^${artist.name}`) }).first().click();
    await settle(page);
    return { shot: await shot(page, "team-member"), list };
  });
}

async function strangerSeesNoTeamNumbers(stranger, salon, artist) {
  await step("غریبه شمارهٔ آرتیست تیم رو هیچ‌جا نمی‌بینه", stranger.view, async () => {
    await stranger.view.page.goto(`${BASE}/salons/${salon.id}`, { waitUntil: "networkidle" });
    await settle(stranger.view.page);
    const html = await stranger.view.page.content();
    must(!shows(html, artist.phone), "the artist's number is on the page");
    must(!shows(JSON.stringify((await stranger.session.get(`/api/salons/${salon.id}`)).payload), artist.phone), "the artist's number is in the server's answer");
    const raw = await (await fetch(`${BASE}/salons/${salon.id}`)).text();
    must(!shows(raw, artist.phone) && !shows(raw, salon.phone), "a number is in the public page");
    return { shot: await shot(stranger.view.page, "stranger-team") };
  });
}

/* ---------- the rounds ---------- */
async function salonWithClient(salonPhone, clientPhone) {
  const salon = await signUp(salonPhone, "salon", SALON);
  const client = await signUp(clientPhone, "client", CLIENT);
  const extra = await signUp(EXTRA_ARTIST, "artist", ARTIST);
  await salon.session.get("/api/salon-hours");
  await salon.session.post("/api/salon-services", { name: SERVICE, price: "350000", duration: "۶۰ دقیقه" });
  salon.view = await open(salon);
  client.view = await open(client);
  await step("سالن ساعت کاری رو ۶ تا ۲۴ می‌ذاره و می‌مونه", salon.view, () => setHoursSixToMidnight(salon.view, "/api/salon-hours"));
  await step("شرایط همکاری هم تا ۲۴ ذخیره می‌شه و آرتیست به تیم میاد", null, async () => { await joinTeam(salon, extra, { days: DAY.weekday }); });
  await teamTabKeepsNumbers(salon, extra);
  await strangerSeesNoTeamNumbers(client, salon, extra);
  await strangerThenConnect(client, salon, "salon");
  await step("ساعت‌ها از ۶ شروع می‌شن و آخری ۲۳ـه، ۲۳:۳۰ نیست", client.view, async () => {
    await placePage(client.view, "salon", salon.id);
    const times = await openHours(client.view);
    checkHours(times);
    return { detail: `${times[0]} ... ${times[times.length - 1]} (${times.length})`, shot: await shot(client.view.page, "hours-list") };
  });
  await requestAndAnswer(client, salon, SALON, "/api/salon-bookings", "bookings");
  await ownEntry(salon);
  await pushAndClock(client);
  await wrongClock(client, "salon", salon.id);
  return [salon.view, client.view];
}

async function artistWithClient() {
  const artist = await signUp(phones[0], "artist", ARTIST);
  const client = await signUp(phones[1], "client", CLIENT);
  await artist.session.post("/api/artist/me", { name: SERVICE, price: "350000", duration: "۶۰ دقیقه" });
  artist.view = await open(artist);
  client.view = await open(client);
  await step("آرتیست ساعت کاری رو ۶ تا ۲۴ می‌ذاره و می‌مونه", artist.view, () => setHoursSixToMidnight(artist.view, "/api/artist-hours"));
  await strangerThenConnect(client, artist, "artist");
  await step("ساعت‌های آرتیست از ۶ شروع می‌شن و آخری ۲۳ـه", client.view, async () => {
    await placePage(client.view, "artist", artist.id);
    const times = await openHours(client.view);
    checkHours(times);
    return { detail: `${times[0]} ... ${times[times.length - 1]} (${times.length})`, shot: await shot(client.view.page, "hours-list") };
  });
  await requestAndAnswer(client, artist, ARTIST, "/api/artist/me", "bookings");
  await ownEntry(artist);
  await pushAndClock(artist);
  return [artist.view, client.view];
}

async function salonWithArtist() {
  const salon = await signUp(phones[0], "salon", SALON);
  const artist = await signUp(phones[1], "artist", ARTIST);
  const stranger = await signUp(EXTRA_CLIENT, "client", CLIENT);
  await salon.session.get("/api/salon-hours");
  await salon.session.post("/api/salon-services", { name: SERVICE, price: "350000", duration: "۶۰ دقیقه" });
  await artist.session.post("/api/artist/me", { name: SERVICE, price: "350000", duration: "۶۰ دقیقه" });
  await step("آرتیست با دو بار زدن همزمان فقط یه بار به تیم اضافه می‌شه", null, async () => { await joinTeam(salon, artist, { from: "10:00", to: "18:00" }); });
  salon.view = await open(salon);
  artist.view = await open(artist);
  stranger.view = await open(stranger);
  await teamTabKeepsNumbers(salon, artist);
  await step("آرتیست سالنش رو توی صفحهٔ خودش می‌بینه", artist.view, async () => {
    const { page } = artist.view;
    await page.locator(".profileModeRail button, [role=tab], button", { hasText: "همکاری" }).first().click();
    await settle(page, 1200);
    must((await page.locator("body").innerText()).includes(SALON), "the salon's name is not on the artist's page");
    return { shot: await shot(page, "artist-home-in-team") };
  });
  await strangerSeesNoTeamNumbers(stranger, salon, artist);
  await step("سالن ۶ تا ۲۴ بازه ولی شرایط آرتیست ۱۰ تا ۱۸ـه: مشتری ۱۰ تا ۱۷ می‌بینه", stranger.view, async () => {
    const rows = (await salon.session.get("/api/salon-hours")).payload.data.hours;
    const week = rows.map((row) => ({ day: row.day, openTime: "۰۶:۰۰", closeTime: "۲۴:۰۰", active: true }));
    const saved = await salon.session.patch("/api/salon-hours", { hours: week });
    must(saved.ok, `saving: ${saved.status} ${JSON.stringify(saved.payload)}`);
    await placePage(stranger.view, "salon", salon.id);
    const times = await openHours(stranger.view);
    must(times[0].includes("۱۰:۰۰") && times[times.length - 1].includes("۱۷:۰۰"), `${times[0]} ... ${times[times.length - 1]}`);
    return { detail: `${times[0]} ... ${times[times.length - 1]}`, shot: await shot(stranger.view.page, "team-terms-hours") };
  });
  await ownEntry(artist);
  return [salon.view, artist.view, stranger.view];
}

const ROUNDS = {
  "salon-client": () => salonWithClient(phones[0], phones[1]),
  "client-salon": () => salonWithClient(phones[1], phones[0]),
  "artist-client": artistWithClient,
  "salon-artist": salonWithArtist
};
if (!ROUNDS[round]) throw new Error(`Rounds: ${Object.keys(ROUNDS).join(", ")}`);

// PW_CHROMIUM: a Chromium binary when Playwright's own is not the installed one (the cloud container), as in tests/e2e/browser.js.
browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const views = await ROUNDS[round]();
  for (const view of views) await view.context.close();
} finally {
  await browser.close();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
  const failed = results.filter((entry) => !entry.ok).length;
  console.log(`\n${round}: ${results.length - failed} of ${results.length} passed`);
}
