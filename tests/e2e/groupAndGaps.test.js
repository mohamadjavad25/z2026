/* global document */
import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { createClient, joinSalonAsArtist, registerUser, futureBookingDay } from "../integration/helpers.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);
const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

const LATIN = (text) => String(text).replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit));
const SERVICE = "کوتاهی مو";

/** A salon with `artists` team members who all do one 45-minute service, and a client connected to it. */
async function seed({ artists = 0, label = "گروه" } = {}) {
  const salonApi = createClient();
  const name = `سالن ${label} ${Math.floor(Math.random() * 1e6)}`;
  const salon = await registerUser(salonApi, { type: "salon", name });
  await salonApi.get("/api/salon-hours");
  const members = [];
  for (let index = 0; index < artists; index += 1) {
    const api = createClient();
    const { user } = await registerUser(api, { type: "artist", name: `آرتیست ${label} ${index}` });
    expect((await joinSalonAsArtist(api, salonApi, salon.user.id)).ok).toBe(true);
    members.push({ api, user });
  }
  const made = await salonApi.post("/api/salon-services", { name: SERVICE, price: "300000", duration: "45 دقیقه" });
  expect(made.ok).toBe(true);
  if (artists) {
    const staff = (await salonApi.get("/api/salon-staff")).payload.data.staff;
    expect((await salonApi.patch("/api/salon-services", { id: made.payload.data.service.id, name: SERVICE, staff_ids: staff.map((person) => String(person.id)) })).ok).toBe(true);
  }
  const clientApi = createClient();
  const customer = await registerUser(clientApi, { type: "client", name: "مشتری گروه" });
  expect((await clientApi.post("/api/connections", { targetUserId: salon.user.id })).ok).toBe(true);
  return { salonApi, salon, name, members, clientApi, customer };
}

/** From the client's home: «رزرو» tab → the connected salon's service → the booking form. */
async function openForm(page) {
  await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
  await page.locator("nav.bottomNav > button").nth(2).click();
  const place = page.locator(".chPlace");
  await place.waitFor();
  await place.locator(".chServices button", { hasText: SERVICE }).click();
  await page.locator(".sduItem.is-selected", { hasText: SERVICE }).waitFor();
  await page.locator(".sduConfirm").click();
  await page.locator(".visitBookerSheet").waitFor();
}

const salonBookings = async (team) => (await team.salonApi.get("/api/salon-bookings")).payload.data.bookings;

/** A day that is not a Thursday or Friday (they close earlier / not at all), `from` days ahead or later. */
function plainOffset(from) {
  for (let offset = from; offset < from + 8; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    if (!["پنجشنبه", "جمعه"].includes(getPersianWeekday(date))) return offset;
  }
  return from;
}
const dayKeyAhead = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return formatPersianDateKey(date);
};
/** The salon's own entries that hold the whole 10:00–20:00 day of a salon with no team. */
async function fillDay(team, offset) {
  for (const [time, minutes] of [["10:00", 360], ["16:00", 240]]) {
    const made = await team.salonApi.post("/api/salon-bookings", { service: SERVICE, bookingDate: dayKeyAhead(offset), time, client: "پر", phone: "", durationMinutes: minutes });
    expect(made.ok, JSON.stringify(made.payload)).toBe(true);
  }
}

describe("«برای چند نفر؟» (browser)", () => {
  it("2 people: only hours with 2 free artists, sent as one request answered together", async () => {
    const team = await seed({ artists: 2, label: "دونفره" });
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    await page.locator(".vbTime.is-on").waitFor();
    const row = page.locator(".vbPeople");
    expect(await row.innerText()).toContain("برای چند نفر؟");
    expect(await row.locator("button").allInnerTexts()).toEqual(["۱", "۲", "۳"]);
    expect(await row.locator("button[aria-pressed=true]").innerText()).toBe("۱");
    await row.locator("button", { hasText: "۲" }).click();
    await page.locator(".vbNote", { hasText: "ساعت‌هایی که برای ۲ نفر با هم جا دارد" }).waitFor();
    await page.locator(".vbPlanRow").nth(1).waitFor();
    expect(await page.locator(".vbPlanRow").allInnerTexts()).toEqual([expect.stringContaining("نفر ۱"), expect.stringContaining("نفر ۲")]);
    await page.getByRole("button", { name: /ارسال درخواست/ }).waitFor();
    await page.locator(".vbSubmit").click();
    const receipt = page.locator(".brScreen");
    await receipt.waitFor();
    expect(await receipt.innerText()).toContain("درخواست ۲ نفره ارسال شد. سالن هر دو را با هم جواب می‌دهد.");
    const mine = (await salonBookings(team)).filter((item) => item.client === "مشتری گروه");
    expect(mine).toHaveLength(1);
    expect(mine[0].service).toContain("۲ نفر");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("nobody free together: «آره، پشت‌سرهم» turns it into two requests back to back at the same salon", async () => {
    const team = await seed({ artists: 0, label: "پشت‌سرهم" });
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbPeople button", { hasText: "۲" }).click();
    const info = page.locator(".vbAhead", { hasText: "ساعت مشترک نیست" });
    await info.waitFor();
    expect(await info.innerText()).toContain("برای ۲ نفر در این روز ساعت مشترک نیست. می‌خواهی دو نوبت پشت‌سرهم بگیری؟");
    await info.getByRole("button", { name: "آره، پشت‌سرهم" }).click();
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbPlanRow").nth(1).waitFor();
    await page.getByRole("button", { name: /ارسال درخواست/ }).waitFor();
    await page.locator(".vbSubmit").click();
    await page.locator(".brScreen").waitFor();
    const mine = (await salonBookings(team)).filter((item) => item.client === "مشتری گروه");
    expect(mine).toHaveLength(1);
    expect(Number(mine[0].duration_minutes)).toBe(90);
    expect(JSON.parse(mine[0].parts)).toHaveLength(2);
    expect(problems).toEqual([]);
    await context.close();
  });
});

describe("no time on the wanted day (browser)", () => {
  it("a full day says when the first free hour is and «برو به آن روز» goes there", async () => {
    const team = await seed({ artists: 0, label: "روزپر" });
    const full = plainOffset(2);
    await fillDay(team, full);
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbDay").nth(full).click();
    const ahead = page.locator(".vbAhead", { hasText: "اولین ساعت خالی:" });
    await ahead.waitFor();
    expect(await ahead.innerText()).toMatch(/اولین ساعت خالی: .+ ۱۰:۰۰/);
    await ahead.getByRole("button", { name: "برو به آن روز" }).click();
    await page.locator(".vbTime.is-on").waitFor();
    expect(await page.locator(".vbDay.is-on").count()).toBe(1);
    expect(await page.locator(".vbDay").nth(full).getAttribute("aria-pressed")).toBe("false");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("a closed day can be tapped and says when the salon opens next", async () => {
    const team = await seed({ artists: 0, label: "تعطیل" });
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbDay.is-closed").first().click();
    const text = await page.locator(".vbTimesSection .vbInfo").innerText();
    expect(text).toMatch(/^این روز سالن تعطیل است\. روز بعد باز: .+\.$/);
    expect(await page.locator(".vbTime").count()).toBe(0);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("nothing for two weeks says so and offers a call to the salon's number", async () => {
    const team = await seed({ artists: 1, label: "دوهفته" });
    const staff = (await team.salonApi.get("/api/salon-staff")).payload.data.staff;
    expect((await team.salonApi.patch("/api/salon-staff", { id: staff[0].id, state: "مرخصی" })).ok).toBe(true);
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    const none = page.locator(".vbAhead", { hasText: "تا دو هفته آینده جا نیست" });
    await none.waitFor();
    expect(await none.innerText()).toContain("تا دو هفته آینده جا نیست. به سالن پیام بده");
    const call = none.getByRole("link", { name: "تماس" });
    expect(await call.getAttribute("href")).toMatch(/^tel:09\d{9}$/);
    expect(problems).toEqual([]);
    await context.close();
  });
});

describe("the hour is taken while sending (browser)", () => {
  async function takeShownHour(team, page) {
    const shown = LATIN(await page.locator(".vbTime.is-on").innerText());
    const day = await page.locator(".vbDay.is-on").count();
    expect(day).toBe(1);
    const dayIndex = await page.evaluate(() => [...document.querySelectorAll(".vbDay")].findIndex((el) => el.classList.contains("is-on")));
    const made = await team.salonApi.post("/api/salon-bookings", { service: SERVICE, bookingDate: dayKeyAhead(dayIndex), time: shown, client: "قاپ‌زن", phone: "", durationMinutes: 30 });
    expect(made.ok, JSON.stringify(made.payload)).toBe(true);
    return { shown, dayIndex };
  }

  it("offers the next free hour: no silent jump; «بله، ارسال» sends that one", async () => {
    const team = await seed({ artists: 0, label: "۴۰۹" });
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbPlanRow").first().waitFor();
    await page.getByRole("button", { name: /ارسال درخواست/ }).waitFor();
    const { shown } = await takeShownHour(team, page);
    await page.locator(".vbSubmit").click();
    const card = page.locator(".vbConflict");
    await card.waitFor();
    const text = await card.innerText();
    expect(text).toMatch(/^این ساعت همین حالا گرفته شد\. ساعت خالیِ بعدی .+ است\. می‌خواهی همین را بفرستم؟/);
    expect(await page.locator(".vbTime.is-on").count()).toBe(0); // it did not move to another hour by itself
    const next = LATIN(text.match(/ساعت خالیِ بعدی (\S+) است/)[1]);
    expect(next > shown).toBe(true);
    await card.getByRole("button", { name: "بله، ارسال" }).click();
    await page.locator(".brScreen").waitFor();
    const mine = (await salonBookings(team)).filter((item) => item.client === "مشتری گروه");
    expect(mine).toHaveLength(1);
    expect(mine[0].time).toBe(next);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("«ساعت دیگر» closes the card and leaves the day's list to choose from", async () => {
    const team = await seed({ artists: 0, label: "۴۰۹ب" });
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbPlanRow").first().waitFor();
    await page.getByRole("button", { name: /ارسال درخواست/ }).waitFor();
    await takeShownHour(team, page);
    await page.locator(".vbSubmit").click();
    const card = page.locator(".vbConflict");
    await card.waitFor();
    await card.getByRole("button", { name: "ساعت دیگر" }).click();
    await card.waitFor({ state: "detached" });
    expect(await page.locator(".vbTime").count()).toBeGreaterThan(1);
    expect(await page.locator(".vbTime.is-on").count()).toBe(0);
    expect((await salonBookings(team)).filter((item) => item.client === "مشتری گروه")).toHaveLength(0);
    expect(problems).toEqual([]);
    await context.close();
  });
});

describe("the salon did not answer (browser)", () => {
  /** A request whose hour ran out: the sweep expires it. */
  async function expire(team, day, time) {
    const created = await team.clientApi.post("/api/salon-bookings", {
      salonUserId: team.salon.user.id, service: SERVICE, bookingDate: day, time, client: team.customer.user.name, phone: team.customer.phone
    });
    expect(created.status).toBe(201);
    await connected;
    await db.query("UPDATE salon_bookings SET created_at = NOW() - INTERVAL '3 hours' WHERE id = $1", [created.payload.data.booking.id]);
    const run = await fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
    expect(run.ok).toBe(true);
  }

  it("«دوباره از همین سالن بپرس» sends a fresh request for the same time", async () => {
    const team = await seed({ artists: 0, label: "بی‌جواب" });
    const day = futureBookingDay(3);
    await expire(team, day, "11:00");
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const note = page.locator(".cvNotes li", { hasText: "جواب نداد" });
    await note.waitFor();
    expect(await note.getByRole("button", { name: "همین نوبت را جای دیگر بگیر" }).count()).toBe(1);
    await note.getByRole("button", { name: "دوباره از همین سالن بپرس" }).click();
    await page.locator(".noticeStack", { hasText: `درخواست تازه برای ${team.name} ارسال شد.` }).waitFor();
    const live = (await team.clientApi.get("/api/client-bookings")).payload.data.salonBookings.filter((item) => item.status === "درخواست");
    expect(live).toHaveLength(1);
    expect(live[0].time).toBe("11:00");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("«همین نوبت را جای دیگر بگیر» lists the connected places and opens the form there with the same service, day and hour", async () => {
    const team = await seed({ artists: 0, label: "جای‌دیگر" });
    const other = await seed({ artists: 0, label: "جای‌بعدی" });
    expect((await team.clientApi.post("/api/connections", { targetUserId: other.salon.user.id })).ok).toBe(true);
    const day = futureBookingDay(3);
    await expire(team, day, "11:00");
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const note = page.locator(".cvNotes li", { hasText: "جواب نداد" });
    await note.waitFor();
    await note.getByRole("button", { name: "همین نوبت را جای دیگر بگیر" }).click();
    const sheet = page.locator(".erSheet");
    await sheet.waitFor();
    expect(await sheet.locator(".erPlace").allInnerTexts()).toEqual([expect.stringContaining(other.name)]);
    await sheet.locator(".erPlace").click();
    await page.locator(".visitBookerSheet").waitFor();
    expect(await page.locator(".visitBookerSheet h2").innerText()).toContain(other.name);
    expect(await page.locator(".vbService.is-on:not(.vbCount)").innerText()).toContain(SERVICE);
    await page.locator(".vbTime.is-on").waitFor();
    expect(LATIN(await page.locator(".vbTime.is-on").innerText())).toBe("11:00");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("nobody else connected: says so and shows the ways to connect", async () => {
    const team = await seed({ artists: 0, label: "تنها" });
    await expire(team, futureBookingDay(3), "11:00");
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const note = page.locator(".cvNotes li", { hasText: "جواب نداد" });
    await note.waitFor();
    await note.getByRole("button", { name: "همین نوبت را جای دیگر بگیر" }).click();
    await page.locator(".erEmpty", { hasText: "هنوز جای دیگری وصل نکرده‌ای. شمارهٔ سالن یا آرتیست بعدی را بزن." }).waitFor();
    expect(problems).toEqual([]);
    await context.close();
  });
});
