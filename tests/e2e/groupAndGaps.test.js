import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { createClient, joinSalonAsArtist, registerUser, futureBookingDay } from "../integration/helpers.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";
import { clientToTicket, closeBrowser, newPage } from "./browser.js";

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

/** From the day step back to the services: the first chip at the top is the services answer. */
async function backToServices(page) {
  await page.locator(".vbCalendar").waitFor();
  await page.locator(".vbDoneChip").first().click();
  await page.locator(".vbCards").waitFor();
}

describe("«برای چند نفر؟» (browser)", () => {
  it("2 people: only hours with 2 free artists, sent as one request answered together", async () => {
    const team = await seed({ artists: 2, label: "دونفره" });
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    await backToServices(page);
    // folded into one line on the services step (owner's decision 2026-11-02)
    await page.getByRole("button", { name: "با دوستت میای؟" }).click();
    const row = page.locator(".vbPeopleRow");
    expect(await row.innerText()).toContain("برای چند نفر؟");
    expect(await row.locator("button").allInnerTexts()).toEqual(["۱", "۲", "۳"]);
    expect(await row.locator("button[aria-pressed=true]").innerText()).toBe("۱");
    await row.locator("button", { hasText: "۲" }).click();
    await page.locator(".vbSubmit").click();
    await page.locator(".vbDayCard.is-free, .vbDayCard.is-few").first().click();
    await page.locator(".vbNote", { hasText: "ساعت‌هایی که ۲ نفر با هم جا می‌شن" }).waitFor();
    await page.locator(".vbTime").first().click();
    await page.locator(".vbPlanRow").nth(1).waitFor();
    expect(await page.locator(".vbPlanRow").allInnerTexts()).toEqual([expect.stringContaining("نفر ۱"), expect.stringContaining("نفر ۲")]);
    await page.getByRole("button", { name: /^درخواست نوبت/ }).waitFor();
    await page.locator(".vbSubmit").click();
    const receipt = page.locator(".brScreen");
    await receipt.waitFor();
    expect(await receipt.innerText()).toContain("درخواست ۲ نفره رفت. سالن هر دو رو با هم جواب می‌ده.");
    const mine = (await salonBookings(team)).filter((item) => item.client === "مشتری گروه");
    expect(mine).toHaveLength(1);
    expect(mine[0].service).toContain("۲ نفر");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("nobody free together: said before the calendar, and «آره، پشت‌سرهم» turns it into two back to back at the same salon", async () => {
    const team = await seed({ artists: 0, label: "پشت‌سرهم" });
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    await backToServices(page);
    await page.getByRole("button", { name: "با دوستت میای؟" }).click();
    await page.locator(".vbPeopleRow button", { hasText: "۲" }).click();
    const info = page.locator(".vbNoRoom", { hasText: "ساعت مشترک نیست" });
    await info.waitFor();
    expect(await info.innerText()).toContain("برای ۲ نفر با هم تا دو هفتهٔ دیگه ساعت مشترک نیست. دو تا نوبت پشت‌سرهم بگیریم؟");
    await info.getByRole("button", { name: "آره، پشت‌سرهم" }).click();
    await info.waitFor({ state: "detached" });
    await page.locator(".vbSubmit").click();
    await clientToTicket(page);
    await page.locator(".vbPlanRow").nth(1).waitFor();
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

describe("the day step says what each day has (browser)", () => {
  it("a full day says «پر»; opened anyway, it names the first free hour and «بریم همون روز» goes there", async () => {
    const team = await seed({ artists: 0, label: "روزپر" });
    const full = plainOffset(2);
    await fillDay(team, full);
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    const card = page.locator(".vbDayCard").nth(full);
    await page.locator(".vbDayCard").nth(full).filter({ hasText: "پر" }).waitFor();
    expect(await card.getAttribute("class")).toContain("is-off");
    await card.click();
    const ahead = page.locator(".vbAhead", { hasText: "اولین ساعت خالی:" });
    await ahead.waitFor();
    expect(await ahead.innerText()).toMatch(/اولین ساعت خالی: .+ ۱۰:۰۰/);
    await ahead.getByRole("button", { name: "بریم همون روز" }).click();
    await page.locator(".vbTime.is-on").waitFor();
    expect(await page.locator(".vbDay.is-on").count()).toBe(1);
    expect(await page.locator(".vbDay").nth(full).getAttribute("aria-pressed")).toBe("false");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("a closed day says «تعطیل» and cannot be opened", async () => {
    const team = await seed({ artists: 0, label: "تعطیل" });
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    const closed = page.locator('.vbDayCard[aria-disabled="true"]').first();
    expect(await closed.innerText()).toContain("تعطیل");
    await closed.click({ force: true });
    expect(await page.locator(".vbCalendar").count()).toBe(1);
    expect(await page.locator(".vbTime").count()).toBe(0);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("nothing for two weeks is said before the calendar, with a call to the salon's number", async () => {
    const team = await seed({ artists: 1, label: "دوهفته" });
    const staff = (await team.salonApi.get("/api/salon-staff")).payload.data.staff;
    expect((await team.salonApi.patch("/api/salon-staff", { id: staff[0].id, state: "مرخصی" })).ok).toBe(true);
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    const none = page.locator(".vbNoRoom", { hasText: "تا دو هفتهٔ دیگه برای این کار جا نیست" });
    await none.waitFor();
    expect(await none.innerText()).toContain("روزهای بعد رو ببین یا به سالن زنگ بزن");
    const call = none.getByRole("link", { name: "تماس" });
    expect(await call.getAttribute("href")).toMatch(/^tel:09\d{9}$/);
    expect(await page.locator(".vbSoonest").count()).toBe(0);
    expect(problems).toEqual([]);
    await context.close();
  });
});

describe("the hour is taken while sending (browser)", () => {
  /** Day `offset` on the calendar → its hours → the first one → the ticket. Returns the hour picked. */
  async function chooseHour(page, offset) {
    await page.locator(".vbDayCard").nth(offset).click();
    const hour = page.locator(".vbTime").first();
    await hour.waitFor();
    const shown = LATIN(await hour.innerText());
    await hour.click();
    await page.locator(".vbTicket .vbPlanRow").first().waitFor();
    await page.getByRole("button", { name: /^درخواست نوبت/ }).waitFor();
    return shown;
  }
  const takeHour = async (team, offset, time, minutes = 30) => {
    const made = await team.salonApi.post("/api/salon-bookings", { service: SERVICE, bookingDate: dayKeyAhead(offset), time, client: "قاپ‌زن", phone: "", durationMinutes: minutes });
    expect(made.ok, JSON.stringify(made.payload)).toBe(true);
  };

  it("several hours left: says how many, never moves by itself, and another one can be sent", async () => {
    const team = await seed({ artists: 0, label: "۴۰۹" });
    const offset = plainOffset(2);
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    const shown = await chooseHour(page, offset);
    await takeHour(team, offset, shown);
    await page.locator(".vbSubmit").click();
    const card = page.locator(".vbTaken");
    await card.waitFor();
    expect(await card.innerText()).toMatch(/همین الان پر شد\. .+ هنوز .+ تا ساعت دیگه خالیه؛ یکی رو انتخاب کن\./);
    expect(await page.locator(".vbTime.is-on").count()).toBe(0); // it did not move to another hour by itself
    const other = LATIN(await page.locator(".vbTime").first().innerText());
    expect(other).not.toBe(shown);
    await page.locator(".vbTime").first().click();
    await page.getByRole("button", { name: /^درخواست نوبت/ }).waitFor();
    await page.locator(".vbSubmit").click();
    await page.locator(".brScreen").waitFor();
    const mine = (await salonBookings(team)).filter((item) => item.client === "مشتری گروه");
    expect(mine).toHaveLength(1);
    expect(mine[0].time).toBe(other);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("one hour left: names it, and «همین … رو می‌خوام» goes to the ticket with it", async () => {
    const team = await seed({ artists: 0, label: "۴۰۹ب" });
    const offset = plainOffset(2);
    // Only 16:00–17:30 stays open: a 45-minute service fits at 16:00 and 16:30.
    await takeHour(team, offset, "10:00", 360);
    await takeHour(team, offset, "17:30", 150);
    const { page, context, problems } = await newPage({ cookie: team.clientApi.cookie() });
    await openForm(page);
    expect(await chooseHour(page, offset)).toBe("16:00");
    await takeHour(team, offset, "16:00", 30);
    await page.locator(".vbSubmit").click();
    const card = page.locator(".vbTaken");
    await card.waitFor();
    expect(await card.innerText()).toContain("فقط ساعت ۱۶:۳۰ مونده.");
    await card.getByRole("button", { name: "همین ۱۶:۳۰ رو می‌خوام" }).click();
    await page.locator(".vbTicket", { hasText: "۱۶:۳۰" }).waitFor();
    await page.getByRole("button", { name: /^درخواست نوبت/ }).waitFor();
    await page.locator(".vbSubmit").click();
    await page.locator(".brScreen").waitFor();
    const mine = (await salonBookings(team)).filter((item) => item.client === "مشتری گروه");
    expect(mine).toHaveLength(1);
    expect(mine[0].time).toBe("16:30");
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
    expect(await note.getByRole("button", { name: "همین نوبت رو جای دیگه بگیر" }).count()).toBe(1);
    await note.getByRole("button", { name: "دوباره از همین سالن بپرس" }).click();
    await page.locator(".noticeStack", { hasText: `درخواست تازه رفت برای ${team.name}.` }).waitFor();
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
    await note.getByRole("button", { name: "همین نوبت رو جای دیگه بگیر" }).click();
    const sheet = page.locator(".erSheet");
    await sheet.waitFor();
    expect(await sheet.locator(".erPlace").allInnerTexts()).toEqual([expect.stringContaining(other.name)]);
    await sheet.locator(".erPlace").click();
    await page.locator(".visitBookerSheet").waitFor();
    expect(await page.locator(".visitBookerSheet h2").innerText()).toContain(other.name);
    // the same service, day and hour: straight to the ticket
    expect(await page.locator(".vbDoneChip").first().innerText()).toContain(SERVICE);
    await page.locator(".vbTicket .vbPlanRow").first().waitFor();
    expect(LATIN(await page.locator(".vbTicketHead b").innerText())).toContain("11:00");
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
    await note.getByRole("button", { name: "همین نوبت رو جای دیگه بگیر" }).click();
    await page.locator(".erEmpty", { hasText: "هنوز به جای دیگه‌ای وصل نشدی؛ از همین‌جا یکی رو اضافه کن." }).waitFor();
    expect(problems).toEqual([]);
    await context.close();
  });
});
