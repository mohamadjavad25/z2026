/* global document, window, axe */
import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, joinSalonAsArtist, registerUser } from "../integration/helpers.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const M = "مانیکور ویزیت"; // 45 min, the nail artist
const H = "کوتاهی ویزیت"; // 30 min, the hair artist
const persianDigits = (value) => String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

/** A salon with a nail artist and a hair artist, each linked to one service, and a client who follows the salon. */
async function seedTeam() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: `سالن ویزیت ${Math.floor(Math.random() * 1e6)}` });
  await salonClient.get("/api/salon-hours");
  const joinAs = async (name) => {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name });
    expect((await joinSalonAsArtist(client, salonClient, salon.user.id)).ok).toBe(true);
    return { client, user };
  };
  const nail = await joinAs("آرتیست ناخن");
  const hair = await joinAs("آرتیست مو");
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
  const staffOf = (artist) => staff.find((person) => Number(person.artist_user_id) === Number(artist.user.id));
  nail.staff = staffOf(nail);
  hair.staff = staffOf(hair);
  const addService = async (name, duration, person) => {
    const created = await salonClient.post("/api/salon-services", { name, price: "300", duration });
    expect(created.ok).toBe(true);
    expect((await salonClient.patch("/api/salon-services", { id: created.payload.data.service.id, name, staff_ids: [String(person.id)] })).ok).toBe(true);
  };
  await addService(M, "۴۵ دقیقه", nail.staff);
  await addService(H, "۳۰ دقیقه", hair.staff);
  const clientApi = createClient();
  const customer = await registerUser(clientApi, { type: "client", name: "مشتری ویزیت" });
  expect((await clientApi.post("/api/connections", { targetUserId: salon.user.id })).ok).toBe(true);
  return { salonClient, salon, nail, hair, clientApi, customer };
}

/** The first day at least `from` days ahead that is not a Friday (the default weekly hours close on Fridays). */
function openOffset(from) {
  for (let offset = from; offset < from + 7; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    if (getPersianWeekday(date) !== "جمعه") return offset;
  }
  return from;
}
const DAY2 = openOffset(2);
const DAY3 = openOffset(3);

const dayKeyAhead = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return formatPersianDateKey(date);
};

async function openSalon(team, options = {}) {
  const view = await newPage({ cookie: team.salonClient.cookie(), ...options });
  await view.page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
  return view;
}

async function openBookingSheet(page) {
  await page.locator("button.is-createBooking").click();
  await page.locator(".visitBookerSheet").waitFor();
}

/** Picks day chip number `offset` (0 = today); skips none, so choose a day the salon is open. */
async function pickDay(page, offset) {
  await page.locator(".vbDay").nth(offset).click();
}

async function pickService(page, name) {
  await page.locator(".vbService", { hasText: name }).click();
}

const pickTime = (page, hhmm) => page.getByRole("button", { name: persianDigits(hhmm), exact: true }).click();
const bookingsOf = async (team) => (await team.salonClient.get("/api/salon-bookings")).payload.data.bookings;
const partsOf = (booking) => JSON.parse(booking.parts || "[]");

describe("VisitBooker for the salon (browser)", () => {
  it("books two services, splits them between the two artists, and puts each share in their calendar", async () => {
    const team = await seedTeam();
    const { page, context, problems } = await openSalon(team);
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("مریم");
    await pickService(page, M);
    await pickService(page, H);
    await pickDay(page, DAY2);
    await pickTime(page, "10:00");
    // who does what is shown before saving, with each service's own clock time
    await page.locator(".vbPlanRow").nth(1).waitFor();
    const rows = await page.locator(".vbPlanRow").allInnerTexts();
    expect(rows[0]).toContain(M);
    expect(rows[0]).toContain("آرتیست ناخن");
    expect(rows[0]).toContain("۱۰:۰۰–۱۰:۴۵");
    expect(rows[1]).toContain(H);
    expect(rows[1]).toContain("آرتیست مو");
    expect(rows[1]).toContain("۱۰:۴۵–۱۱:۱۵");
    await page.locator(".vbSubmit").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect(problems).toEqual([]);

    const [booking] = await bookingsOf(team);
    expect(booking.client).toBe("مریم");
    expect(booking.status).toBe("تازه");
    expect(booking.booking_date).toBe(dayKeyAhead(DAY2));
    expect(booking.time).toBe("10:00");
    expect(Number(booking.duration_minutes)).toBe(75);
    expect(partsOf(booking).map((p) => [p.service, p.minutes, p.staff])).toEqual([[M, 45, team.nail.staff.name], [H, 30, team.hair.staff.name]]);
    for (const [artist, service, time] of [[team.nail, M, "10:00"], [team.hair, H, "10:45"]]) {
      const share = (await artist.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "مریم");
      expect(share.map((b) => [b.service, b.time])).toEqual([[service, time]]);
    }
    await context.close();
  });

  it("books a single service with the artist shown on screen, not unassigned, and holds that artist for its own length", async () => {
    const team = await seedTeam();
    const { page, context, problems } = await openSalon(team);
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("تک‌خدمتی");
    await pickService(page, H);
    await pickDay(page, DAY2);
    await pickTime(page, "10:00");
    await page.locator(".vbPlanRow").first().waitFor();
    expect(await page.locator(".vbPlanRow").first().innerText()).toContain("آرتیست مو");
    await page.locator(".vbSubmit").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect(problems).toEqual([]);
    const [booking] = await bookingsOf(team);
    expect(booking.staff).toBe(team.hair.staff.name);
    expect(Number(booking.duration_minutes)).toBe(30);
    const mine = (await team.hair.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "تک‌خدمتی");
    expect(mine.map((b) => [b.time, Number(b.duration_minutes)])).toEqual([["10:00", 30]]);
    await context.close();
  });

  it("lets the salon give one service to another artist, and saves exactly that", async () => {
    const team = await seedTeam();
    const { page, context, problems } = await openSalon(team);
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("نرگس");
    await pickService(page, M);
    await pickService(page, H);
    await pickDay(page, DAY2);
    await pickTime(page, "11:00");
    await page.locator(".vbPlanRow").nth(1).waitFor();
    await page.locator(".vbPlanRow").nth(0).locator("button.vbWho2").click();
    const list = page.locator(".vbStaffList");
    await list.waitFor();
    // the hair artist is free then (not skilled in manicure, but the salon may hand it over)
    await list.getByRole("button", { name: /آرتیست مو/ }).click();
    await page.locator(".vbPlanRow").nth(0).locator(".vbWho2", { hasText: "آرتیست مو" }).waitFor();
    await page.locator(".vbSubmit").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect(problems).toEqual([]);
    const [booking] = await bookingsOf(team);
    expect(partsOf(booking).map((p) => p.staff)).toEqual([team.hair.staff.name, team.hair.staff.name]);
    const mine = (await team.hair.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "نرگس");
    expect(mine).toHaveLength(1);
    expect(Number(mine[0].duration_minutes)).toBe(75);
    expect((await team.nail.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "نرگس")).toHaveLength(0);
    await context.close();
  });

  it("shows an artist who is busy at that time as busy and does not let them be picked", async () => {
    const team = await seedTeam();
    const day = dayKeyAhead(DAY3);
    expect((await team.salonClient.post("/api/salon-bookings", { service: H, staff: team.hair.staff.name, bookingDate: day, time: "10:00", client: "حضوری", phone: "09120004001" })).ok).toBe(true);
    const { page, context, problems } = await openSalon(team);
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("سارا");
    await pickService(page, M);
    await pickDay(page, DAY3);
    await pickTime(page, "10:00");
    await page.locator(".vbPlanRow").first().locator("button.vbWho2").click();
    const busy = page.locator(".vbStaffList").getByRole("button", { name: /آرتیست مو/ });
    expect(await busy.getAttribute("aria-disabled")).toBe("true");
    expect(await busy.innerText()).toContain("مشغول");
    await busy.click({ force: true });
    // still the nail artist, and still one click from saving
    expect(await page.locator(".vbPlanRow").first().innerText()).toContain("آرتیست ناخن");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("says what is missing instead of saving, and takes you to it", async () => {
    const team = await seedTeam();
    const { page, context } = await openSalon(team);
    await openBookingSheet(page);
    await pickService(page, H);
    await pickDay(page, DAY2);
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbSubmit").click({ force: true });
    expect(await page.locator(".vbHint").innerText()).toBe("برای ثبت لازم است: نام مشتری");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("vb-name");
    expect(await bookingsOf(team)).toHaveLength(0);
    // with nothing chosen at all, the hint lists everything in reading order
    await page.locator(".vbService", { hasText: H }).click();
    await page.locator(".vbSubmit").click({ force: true });
    expect(await page.locator(".vbHint").innerText()).toBe("برای ثبت لازم است: خدمت، نام مشتری، ساعت");
    await context.close();
  });

  it("books once however fast the button is hit", async () => {
    const team = await seedTeam();
    const { page, context, problems } = await openSalon(team);
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("دوبار");
    await pickService(page, H);
    await pickDay(page, DAY2);
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbPlanRow").first().waitFor();
    await page.locator(".vbSubmit").dblclick();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect((await bookingsOf(team)).filter((b) => b.client === "دوبار")).toHaveLength(1);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("saves from the keyboard: Enter in the name field", async () => {
    const team = await seedTeam();
    const { page, context } = await openSalon(team);
    await openBookingSheet(page);
    await pickService(page, H);
    await pickDay(page, DAY2);
    await page.locator(".vbPlanRow").first().waitFor();
    await page.locator("#vb-name").fill("با کیبورد");
    await page.locator("#vb-name").press("Enter");
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect((await bookingsOf(team)).filter((b) => b.client === "با کیبورد")).toHaveLength(1);
    await context.close();
  });

  it("closes with the phone's back button and with Escape, saving nothing", async () => {
    const team = await seedTeam();
    const { page, context } = await openSalon(team);
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("پشیمان");
    await page.goBack();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect(page.url()).toContain(new URL(TEST_BASE_URL).host);
    await openBookingSheet(page);
    await page.keyboard.press("Escape");
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect(await bookingsOf(team)).toHaveLength(0);
    // there is no close button on the sheet: back is the way out
    await openBookingSheet(page);
    expect(await page.locator(".sheetClose").count()).toBe(0);
    await context.close();
  });

  it("does not let a closed day be picked", async () => {
    const team = await seedTeam();
    const { page, context } = await openSalon(team);
    await openBookingSheet(page);
    const days = page.locator(".vbDay");
    const closed = days.filter({ hasText: "تعطیل" });
    expect(await closed.count()).toBeGreaterThan(0);
    const before = await page.locator(".vbDay.is-on").innerText();
    await closed.first().click({ force: true });
    expect(await closed.first().getAttribute("aria-disabled")).toBe("true");
    expect(await page.locator(".vbDay.is-on").innerText()).toBe(before);
    await context.close();
  });

  it("tells you a time was taken in the meantime, offers fresh times, and the next try goes through", async () => {
    const team = await seedTeam();
    const day = dayKeyAhead(DAY2);
    const { page, context, problems } = await openSalon(team);
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("دیرتر");
    await pickService(page, H);
    await pickDay(page, DAY2);
    await pickTime(page, "10:00");
    await page.locator(".vbPlanRow").first().waitFor();
    // somebody else takes the hair artist at 10:00 while this form is open
    expect((await team.salonClient.post("/api/salon-bookings", { service: H, staff: team.hair.staff.name, bookingDate: day, time: "10:00", client: "زودتر", phone: "09120004002" })).ok).toBe(true);
    await page.locator(".vbSubmit").click();
    await page.locator(".vbHint").waitFor();
    expect(await page.locator(".vbHint").innerText()).toMatch(/[؀-ۿ]/);
    expect((await bookingsOf(team)).filter((b) => b.client === "دیرتر")).toHaveLength(0);
    // the list was asked for again: 10:00 is gone and another time is chosen and fine
    await page.getByRole("button", { name: "۱۰:۰۰", exact: true }).waitFor({ state: "detached" });
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbPlanRow").first().waitFor();
    await page.locator(".vbSubmit").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect((await bookingsOf(team)).filter((b) => b.client === "دیرتر")).toHaveLength(1);
    expect(problems.filter((line) => !line.includes("409"))).toEqual([]);
    await context.close();
  });

  it("shows a failure to load the times, and recovers on retry", async () => {
    const team = await seedTeam();
    const { page, context } = await openSalon(team);
    await page.route("**/api/salon-bookings/availability*", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await openBookingSheet(page);
    await pickService(page, H);
    await pickDay(page, DAY2);
    const failure = page.locator(".vbInfo.is-error");
    await failure.waitFor();
    expect(await failure.innerText()).toContain("ساعت‌های آزاد بارگیری نشد");
    // nothing can be saved meanwhile
    await page.locator("#vb-name").fill("اینترنت");
    await page.locator(".vbSubmit").click({ force: true });
    expect(await bookingsOf(team)).toHaveLength(0);
    await page.unroute("**/api/salon-bookings/availability*");
    await failure.getByRole("button", { name: /دوباره امتحان/ }).click();
    await page.locator(".vbTime.is-on").waitFor();
    await context.close();
  });

  it("shows a failure to check the plan, blocks saving, and recovers on retry", async () => {
    const team = await seedTeam();
    const { page, context } = await openSalon(team);
    await page.route("**/api/salon-bookings/preview*", (route) => route.abort());
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("نامطمئن");
    await pickService(page, H);
    await pickDay(page, DAY2);
    const failure = page.locator(".vbPlanSection .vbInfo.is-error");
    await failure.waitFor();
    await page.locator(".vbSubmit").click({ force: true });
    expect(await bookingsOf(team)).toHaveLength(0);
    await page.unroute("**/api/salon-bookings/preview*");
    await failure.getByRole("button", { name: /دوباره امتحان/ }).click();
    await page.locator(".vbPlanRow").first().waitFor();
    await page.locator(".vbSubmit").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect((await bookingsOf(team)).filter((b) => b.client === "نامطمئن")).toHaveLength(1);
    await context.close();
  });

  it("recalculates when a service is taken off after a time was chosen", async () => {
    const team = await seedTeam();
    const { page, context } = await openSalon(team);
    await openBookingSheet(page);
    await pickService(page, M);
    await pickService(page, H);
    await pickDay(page, DAY2);
    await page.locator(".vbPlanRow").nth(1).waitFor();
    expect(await page.locator(".vbSummary").innerText()).toContain("۲ خدمت · ۷۵ دقیقه");
    await pickService(page, H);
    await page.waitForFunction(() => document.querySelectorAll(".vbPlanRow").length === 1);
    expect(await page.locator(".vbSummary").innerText()).toContain("۱ خدمت · ۴۵ دقیقه");
    expect(await page.locator(".vbPlanRow").first().innerText()).toContain(M);
    await context.close();
  });

  it("keeps a visit to eight services and says so", async () => {
    const team = await seedTeam();
    for (let i = 1; i <= 8; i += 1) await team.salonClient.post("/api/salon-services", { name: `خدمت اضافه ${i}`, price: "100", duration: "۱۵ دقیقه" });
    const { page, context } = await openSalon(team);
    await openBookingSheet(page);
    const chips = page.locator(".vbService");
    expect(await chips.count()).toBe(10);
    for (let i = 0; i < 9; i += 1) await chips.nth(i).click();
    expect(await page.locator(".vbService.is-on").count()).toBe(8);
    expect(await page.locator(".vbSummary").innerText()).toContain("حداکثر ۸ خدمت");
    await context.close();
  });

  it("offers adding the first service when the salon has none", async () => {
    const salonClient = createClient();
    await registerUser(salonClient, { type: "salon", name: "سالن بی‌خدمت" });
    const { page, context } = await newPage({ cookie: salonClient.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openBookingSheet(page);
    await page.locator(".vbEmpty").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    await context.close();
  });
});

describe("VisitBooker opened from the customers page (browser)", () => {
  it("starts with that customer's name and number filled in and stays on the customers page", async () => {
    const team = await seedTeam();
    expect((await team.salonClient.post("/api/salon-bookings", { service: H, staff: team.hair.staff.name, bookingDate: dayKeyAhead(DAY3), time: "12:00", client: "مشتری قدیمی", phone: "09123334455" })).ok).toBe(true);
    const { page, context, problems } = await openSalon(team);
    await page.locator("nav.bottomNav > button").nth(2).click();
    await page.getByRole("button", { name: "جزئیات مشتری قدیمی" }).click();
    await page.locator(".cuBookBtn").click();
    await page.locator(".visitBookerSheet").waitFor();
    expect(await page.locator("#vb-name").inputValue()).toBe("مشتری قدیمی");
    expect(await page.locator("#vb-phone").inputValue()).toBe("09123334455");
    // closing it with back leaves the customers page as it was
    await page.goBack();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect(await page.locator("nav.bottomNav > button").nth(2).getAttribute("class")).toContain("active");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("offers earlier customers as one-tap suggestions", async () => {
    const team = await seedTeam();
    expect((await team.salonClient.post("/api/salon-bookings", { service: H, staff: team.hair.staff.name, bookingDate: dayKeyAhead(DAY3), time: "12:00", client: "نرگس قدیمی", phone: "09125556677" })).ok).toBe(true);
    const { page, context } = await openSalon(team);
    await openBookingSheet(page);
    await page.locator(".vbPerson", { hasText: "نرگس قدیمی" }).click();
    expect(await page.locator("#vb-name").inputValue()).toBe("نرگس قدیمی");
    expect(await page.locator("#vb-phone").inputValue()).toBe("09125556677");
    // typing narrows them; a full match is not offered again
    await page.locator("#vb-name").fill("نر");
    expect(await page.locator(".vbPerson").count()).toBe(1);
    await page.locator("#vb-name").fill("نرگس قدیمی");
    expect(await page.locator(".vbPerson").count()).toBe(0);
    await context.close();
  });
});

describe("VisitBooker for an independent artist (browser)", () => {
  it("books two services as one entry as long as both, in their own calendar", async () => {
    const artistApi = createClient();
    const artist = await registerUser(artistApi, { type: "artist", name: "آرتیست مستقل" });
    expect((await artistApi.post("/api/artist/me", { name: "ابرو ویزیت", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
    expect((await artistApi.post("/api/artist/me", { name: "ناخن ویزیت", price: "200", duration: "۴۵ دقیقه" })).ok).toBe(true);
    const { page, context, problems } = await newPage({ cookie: artistApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("مشتری حضوری");
    await pickService(page, "ابرو ویزیت");
    await pickService(page, "ناخن ویزیت");
    await pickDay(page, DAY2);
    await pickTime(page, "10:00");
    // one artist: the services are listed one after another, with no artist to pick
    await page.locator(".vbPlanRow").nth(1).waitFor();
    expect(await page.locator(".vbStaffList, button.vbWho2").count()).toBe(0);
    const rows = await page.locator(".vbPlanRow").allInnerTexts();
    expect(rows[0]).toContain("۱۰:۰۰–۱۰:۳۰");
    expect(rows[1]).toContain("۱۰:۳۰–۱۱:۱۵");
    await page.locator(".vbSubmit").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    expect(problems).toEqual([]);
    const mine = (await artistApi.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "مشتری حضوری");
    expect(mine).toHaveLength(1);
    expect(mine[0].service).toBe("ابرو ویزیت + ناخن ویزیت");
    expect(Number(mine[0].duration_minutes)).toBe(75);
    expect(mine[0].time).toBe("10:00");
    expect(mine[0].booking_date).toBe(dayKeyAhead(DAY2));
    expect(mine[0].status).toBe("تایید");
    expect(artist.user.id).toBeTruthy();
    await context.close();
  });

  it("tells the artist a time was taken in the meantime, with fresh times from their own calendar", async () => {
    const artistApi = createClient();
    const artist = await registerUser(artistApi, { type: "artist", name: "آرتیست شلوغ" });
    expect((await artistApi.post("/api/artist/me", { name: "ابرو شلوغ", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
    const { page, context, problems } = await newPage({ cookie: artistApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("دیرتر");
    await pickService(page, "ابرو شلوغ");
    await pickDay(page, DAY2);
    await pickTime(page, "10:00");
    // a client takes 10:00 straight from the artist's page while the form is open
    const clientApi = createClient();
    const customer = await registerUser(clientApi, { type: "client", name: "مشتری زودتر" });
    expect((await clientApi.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ابرو شلوغ", bookingDate: dayKeyAhead(DAY2), time: "10:00", durationMinutes: 30, clientName: customer.user.name, phone: customer.phone })).ok).toBe(true);
    await page.locator(".vbSubmit").click();
    await page.locator(".vbHint").waitFor();
    expect(await page.locator(".vbHint").innerText()).toMatch(/[؀-ۿ]/);
    // the artist's own list was asked for again: 10:00 is gone, another time is chosen, and saving that works
    await page.getByRole("button", { name: "۱۰:۰۰", exact: true }).waitFor({ state: "detached" });
    await page.locator(".vbTime.is-on").waitFor();
    await page.locator(".vbSubmit").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    const mine = (await artistApi.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "دیرتر");
    expect(mine).toHaveLength(1);
    expect(mine[0].time).not.toBe("10:00");
    expect(problems.filter((line) => !line.includes("409"))).toEqual([]);
    await context.close();
  });

  it("a single service keeps its own length (it used to be an hour whatever the service)", async () => {
    const artistApi = createClient();
    await registerUser(artistApi, { type: "artist", name: "آرتیست سی دقیقه" });
    expect((await artistApi.post("/api/artist/me", { name: "ابرو کوتاه", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
    const { page, context } = await newPage({ cookie: artistApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openBookingSheet(page);
    await page.locator("#vb-name").fill("نیم‌ساعته");
    await pickService(page, "ابرو کوتاه");
    await pickDay(page, DAY2);
    await pickTime(page, "10:00");
    await page.locator(".vbSubmit").click();
    await page.locator(".visitBookerSheet").waitFor({ state: "detached" });
    const [booking] = (await artistApi.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "نیم‌ساعته");
    expect(Number(booking.duration_minutes)).toBe(30);
    await context.close();
  });
});

describe("VisitBooker for a client (browser)", () => {
  it("shows who does what, cannot change it, and sends one request that the salon sees split between the artists", async () => {
    const team = await seedTeam();
    const view = await newPage({ cookie: team.clientApi.cookie() });
    const cp = view.page;
    await cp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await cp.locator("nav.bottomNav > button").nth(2).click();
    await cp.locator(".chPlace").waitFor();
    await cp.locator(".chPlace .chServices button", { hasText: M }).click();
    await cp.locator(".sduItem", { hasText: H }).click();
    await cp.locator(".sduConfirm").click();
    await cp.locator(".visitBookerSheet").waitFor();
    // the services they picked are already on, and the customer's own details are read-only
    expect(await cp.locator(".vbService.is-on").count()).toBe(2);
    expect(await cp.locator("#vb-name").count()).toBe(0);
    expect(await cp.locator(".vbWho").innerText()).toContain("مشتری ویزیت");
    await cp.locator(".vbPlanRow").nth(1).waitFor();
    const rows = await cp.locator(".vbPlanRow").allInnerTexts();
    expect(rows[0]).toContain("آرتیست ناخن");
    expect(rows[1]).toContain("آرتیست مو");
    expect(await cp.locator("button.vbWho2").count()).toBe(0);
    expect(await cp.locator(".vbSubmit").innerText()).toContain("ارسال درخواست");
    await cp.locator(".vbSubmit").click();
    await cp.locator(".brScreen").waitFor();
    expect(view.problems).toEqual([]);

    const [booking] = await bookingsOf(team);
    expect(booking.status).toBe("درخواست");
    expect(partsOf(booking).map((p) => p.staff)).toEqual([team.nail.staff.name, team.hair.staff.name]);
    await view.context.close();
  });
});

describe("VisitBooker layout and accessibility (browser)", () => {
  for (const [width, height] of [[360, 640], [390, 800]]) {
    it(`fits ${width}x${height} with the save button in view and no sideways scroll`, async () => {
      const team = await seedTeam();
      const { page, context } = await newPage({ cookie: team.salonClient.cookie(), width });
      await page.setViewportSize({ width, height });
      await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
      await openBookingSheet(page);
      await page.locator("#vb-name").fill("اندازه");
      await pickService(page, M);
      await pickService(page, H);
      await pickDay(page, DAY2);
      await page.locator(".vbPlanRow").nth(1).waitFor();
      const metrics = await page.evaluate(() => {
        const sheet = document.querySelector(".visitBookerSheet");
        const button = document.querySelector(".vbSubmit").getBoundingClientRect();
        const body = document.querySelector(".vbBody");
        return {
          sideways: document.scrollingElement.scrollWidth > window.innerWidth || sheet.scrollWidth > sheet.clientWidth,
          buttonInView: button.top >= 0 && button.bottom <= window.innerHeight && button.left >= 0 && button.right <= window.innerWidth,
          bodyOverflow: body.scrollHeight - body.clientHeight,
          buttonHeight: button.height
        };
      });
      expect(metrics.sideways).toBe(false);
      expect(metrics.buttonInView).toBe(true);
      expect(metrics.buttonHeight).toBeGreaterThanOrEqual(44);
      // two services and a day of times fit without scrolling the form
      if (height >= 800) expect(metrics.bodyOverflow).toBeLessThanOrEqual(1);
      await context.close();
    });
  }

  it("has no serious or critical axe violations for the salon, the artist and the client", async () => {
    const axePath = new URL("../../node_modules/axe-core/axe.min.js", import.meta.url).pathname;
    const team = await seedTeam();
    const artistApi = createClient();
    await registerUser(artistApi, { type: "artist", name: "آرتیست محور" });
    await artistApi.post("/api/artist/me", { name: "خدمت محور", price: "100", duration: "۳۰ دقیقه" });
    const scenarios = [
      ["salon", team.salonClient, async (page) => { await openBookingSheet(page); await pickService(page, M); await pickService(page, H); await pickDay(page, DAY2); await page.locator(".vbPlanRow").nth(1).waitFor(); await page.locator(".vbPlanRow").first().locator("button.vbWho2").click(); }],
      ["artist", artistApi, async (page) => { await openBookingSheet(page); await pickService(page, "خدمت محور"); await pickDay(page, DAY2); await page.locator(".vbPlanRow").first().waitFor(); }],
      ["client", team.clientApi, async (page) => {
        await page.locator("nav.bottomNav > button").nth(2).click();
        await page.locator(".chPlace .chServices button", { hasText: M }).click();
        await page.locator(".sduConfirm").click();
        await page.locator(".visitBookerSheet").waitFor();
        await page.locator(".vbPlanRow").first().waitFor();
      }]
    ];
    for (const [label, api, open] of scenarios) {
      const { page, context } = await newPage({ cookie: api.cookie() });
      await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
      await open(page);
      await page.waitForTimeout(500);
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => {
        const result = await axe.run(document.querySelector(".visitBookerSheet"), { resultTypes: ["violations"] });
        return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 100)}`);
      });
      expect(violations, label).toEqual([]);
      await context.close();
    }
  }, 120_000);
});
