/**
 * Pictures for the welcome and tutorial slides, taken from brand-new accounts («سالن نمونه», «آرتیست نمونه»,
 * «مشتری نمونه») on an empty, throwaway database: first each account as it is right after sign-up, then the same
 * account after the step the slide teaches (a service added, a salon connected, a request sent). Owner's rule
 * (2026-11-01): the tutorial starts from zero, never with the demo people of docs/screens.
 *
 *   SCREENS_BASE_URL=http://localhost:3200 SCREENS_OUT=<folder> node scripts/screens/tutorial.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

const BASE = process.env.SCREENS_BASE_URL || "http://localhost:3200";
const OUT = process.env.SCREENS_OUT || "tutorial-screens";
const PASSWORD = "tutorial-pass-123";
const PEOPLE = {
  salon: { phone: "09126660001", type: "salon", name: "سالن نمونه" },
  artist: { phone: "09126660002", type: "artist", name: "آرتیست نمونه" },
  client: { phone: "09126660003", type: "client", name: "مشتری نمونه" }
};

function api(cookie = "") {
  const request = async (route, method, body) => {
    const res = await fetch(BASE + route, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return { ok: res.ok, status: res.status, payload: await res.json().catch(() => ({})) };
  };
  return { cookie: () => cookie, get: (r) => request(r, "GET"), post: (r, b) => request(r, "POST", b), patch: (r, b) => request(r, "PATCH", b) };
}

/** The next open (non-Friday) day, as the API's date key. */
function nextOpenDay() {
  const day = new Date();
  do day.setDate(day.getDate() + 1); while (getPersianWeekday(day) === "جمعه");
  return formatPersianDateKey(day);
}

const tab = (i) => async (p) => { await p.locator("nav.bottomNav > button").nth(i).click(); await p.waitForTimeout(1000); };
const tap = (name) => async (p) => { await p.getByRole("button", { name }).first().click({ timeout: 4000, force: true }); await p.waitForTimeout(1000); };
const text = (t) => async (p) => { await p.getByText(t, { exact: true }).first().click({ timeout: 4000 }); await p.waitForTimeout(1000); };
const rail = (name) => async (p) => { await p.locator(".profileModeRail button, [role=tab], button", { hasText: name }).first().click({ timeout: 4000 }); await p.waitForTimeout(1000); };

let browser;
const sessions = {};
const ids = {};

async function shoot(id, role, steps = [], { keepDialogs = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, locale: "fa-IR", isMobile: true, hasTouch: true });
  await context.addInitScript({ content: `try { localStorage.setItem("frfro-entered", "1"); const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith("frfro-tip") || k === "frfro-due-later" ? "1" : g.call(this, k); }; } catch (e) {}` });
  if (role !== "guest") {
    const [name, ...rest] = sessions[role].cookie().split("=");
    await context.addCookies([{ name, value: rest.join("="), url: BASE }]);
  }
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  if (!keepDialogs) {
    for (let k = 0; k < 3; k += 1) {
      const close = page.locator(".sbmScreen button", { hasText: "بستن" });
      if (!(await close.count())) break;
      await close.first().click().catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  for (const step of steps) {
    try { await step(page); } catch (error) { problems.push(`step: ${error.message.split("\n")[0]}`); }
  }
  await page.waitForTimeout(900);
  await page.addStyleTag({ content: ".notice-glass { display: none !important; }" });
  await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 85 });
  console.log(`${id}${problems.length ? `  (${problems[0].slice(0, 100)})` : ""}`);
  await context.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [key, person] of Object.entries(PEOPLE)) {
    const client = api();
    const res = await client.post("/api/auth/register", { phone: person.phone, password: PASSWORD, type: person.type, name: person.name });
    if (!res.ok) throw new Error(`${key}: ${JSON.stringify(res.payload)} (use an empty database)`);
    sessions[key] = client;
    ids[key] = res.payload.data?.user?.id;
  }
  browser = await chromium.launch();

  // Before sign-up.
  await shoot("guest-welcome", "guest");
  await shoot("guest-signup-salon", "guest", [text("سالن")]);

  // Right after sign-up: nothing in the accounts yet.
  await shoot("salon-home", "salon");
  await shoot("salon-complete-profile", "salon", [tap("بریم")]);
  await shoot("salon-services", "salon", [rail("خدمات")]);
  await shoot("salon-staff", "salon", [rail("پرسنل")]);
  await shoot("salon-customers", "salon", [tab(2)]);
  await shoot("artist-home", "artist");
  await shoot("artist-services", "artist", [rail("خدمات")]);
  await shoot("artist-collab", "artist", [rail("همکاری")]);
  await shoot("client-home", "client");
  await shoot("client-book-tab", "client", [tab(2)]);
  await shoot("client-find-tab", "client", [tab(2), async (p) => { await p.getByRole("tab", { name: "پیدا کردن" }).click(); await p.waitForTimeout(900); }]);

  // The steps the slides teach: the salon and the artist add a service, the client connects to the salon and asks
  // for a booking, then the salon sees the request; the client also books the artist so the artist has a day.
  const { salon, artist, client } = sessions;
  await salon.get("/api/salon-hours");
  // A one-person salon: the owner turns on «خودم هم کار می‌کنم», so the salon's services have someone to do them.
  await salon.post("/api/salon-staff/self", {});
  await salon.post("/api/salon-services", { name: "کوتاهی مو", price: "350000", duration: "۴۵ دقیقه" });
  await salon.post("/api/salon-services", { name: "رنگ مو", price: "1200000", duration: "۱۲۰ دقیقه" });
  await artist.post("/api/artist/me", { name: "کاشت ناخن", price: "800000", duration: "۹۰ دقیقه" });
  await client.post("/api/follows", { targetUserId: ids.salon, follow: true });
  await client.post("/api/follows", { targetUserId: ids.artist, follow: true });
  const pickSalon = async (p) => { await p.locator("button", { hasText: PEOPLE.salon.name }).first().click({ timeout: 4000 }); await p.waitForTimeout(1000); };
  await shoot("client-book-tab-connected", "client", [tab(2), pickSalon]);
  await shoot("client-booker", "client", [tab(2), pickSalon, async (p) => {
    await p.locator("button", { hasText: "کوتاهی مو" }).filter({ hasText: "رزرو" }).first().click(); await p.waitForTimeout(1200);
    await p.locator(".sduConfirm").click(); await p.waitForTimeout(1500);
  }]);
  const day = nextOpenDay();
  await client.post("/api/salon-bookings", { salonUserId: ids.salon, service: "کوتاهی مو", bookingDate: day, time: "۱۷:۰۰", client: PEOPLE.client.name, phone: PEOPLE.client.phone });
  await client.post("/api/artist/bookings", { artistUserId: ids.artist, service: "کاشت ناخن", bookingDate: day, time: "۱۲:۰۰" });
  await shoot("client-home-booked", "client");
  await shoot("salon-request-on-open", "salon", [], { keepDialogs: true });
  await shoot("artist-day", "artist", [tap("روز بعد")]);
  await shoot("artist-home-empty", "artist");

  await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
