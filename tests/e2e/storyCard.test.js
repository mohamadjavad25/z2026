/* global document, getComputedStyle */
import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { confirmedAt, directConfirmed, newArtist, newClient, teamSalon } from "../integration/exitHelpers.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { getTehranClockMinutes, timeLabelToMinutes } from "../../app/shared/lib/time.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const DAY_MS = 24 * 60 * 60 * 1000;
const todayKey = () => formatPersianDateKey(new Date());
const tomorrowKey = () => formatPersianDateKey(new Date(Date.now() + DAY_MS));

/** The story card and the story maker, in a real phone-sized browser against the real app and database (owner's rules
 *  2026-11-01: frfro only suggests times, the owner decides; up to two days; nothing about cancelled bookings). */
async function complete(api, extra = {}) {
  const res = await api.post("/api/profile", { data: { avatar: PNG, service: "مو", area: "تهران، خیابان گلستان", geo: { lat: 35.7219, lng: 51.3347 }, ...extra } });
  expect(res.ok).toBe(true);
}

/** Free start times a client could still request, for one day, straight from the server. */
async function freeTimes(salon, day, service = "کوتاهی مو") {
  const query = new URLSearchParams({ salonUserId: String(salon.id), day });
  query.append("service", service);
  const res = await salon.api.get(`/api/salon-bookings/availability?${query}`);
  return res.payload?.data?.times || [];
}

/** A day (tomorrow first) with at least `need` free times, and its times. */
async function pickDay(salon, need = 1) {
  for (const day of [tomorrowKey(), todayKey()]) {
    const times = (await freeTimes(salon, day)).filter((time) => day !== todayKey() || timeLabelToMinutes(time) - getTehranClockMinutes() > 150);
    if (times.length >= need + 2) return { day, times };
  }
  throw new Error("no day with free times");
}

async function openHome(client, { init = "", dark = false } = {}) {
  const opened = await newPage({ cookie: client.api.cookie() });
  if (dark) await opened.page.emulateMedia({ colorScheme: "dark" });
  if (init) await opened.context.addInitScript({ content: init });
  // Nothing outside the app (fonts, maps) may hold the page back where the network is closed.
  await opened.context.route((url) => !url.href.startsWith(TEST_BASE_URL) && !url.href.startsWith("data:"), (route) => route.abort());
  opened.page.setDefaultTimeout(12000);
  await opened.page.goto(TEST_BASE_URL, { waitUntil: "load" });
  return opened;
}

const card = (page) => page.locator(".storyNudge");

async function openMaker(page) {
  await card(page).waitFor();
  await page.locator(".storyNudgeMain").dispatchEvent("click");
  await page.locator(".igStudioPicture img").first().waitFor({ timeout: 20000 });
}

describe("the story card on a salon's home (browser)", () => {
  it("says how many times are free and never talks about a cancelled booking", async () => {
    const { salon, members } = await teamSalon("Story Salon", 2);
    await complete(salon.api);
    const { day, times } = await pickDay(salon, 2);
    const client = await newClient("Story Client");
    const id = await confirmedAt(salon, client, { day, time: times[0], staff: members[0].staff.name });
    expect((await salon.api.patch("/api/salon-bookings", { id, status: "لغو" })).ok).toBe(true);

    const { page, context, problems } = await openHome(salon);
    await card(page).waitFor();
    const text = await card(page).innerText();
    expect(text).toMatch(/(امروز|فردا) .+ وقت خالی داری/);
    expect(text).not.toContain("لغو");
    expect(text).not.toContain("آزاد شد");
    expect(text).toContain("بساز");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("puts a card with the profile reminder in one slider of one size, moves by itself, and the × leaves the other", async () => {
    const { salon } = await teamSalon("Slider Salon", 1);
    // Everything but the logo: the completeness card stays, and the story card joins it.
    await complete(salon.api, { avatar: "" });
    await pickDay(salon, 1);
    const { page, context, problems } = await openHome(salon);
    await card(page).waitFor();
    const slides = page.locator(".homeCardsTrack > section");
    expect(await slides.count()).toBe(2);
    const heights = await slides.evaluateAll((list) => list.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);
    expect(await page.locator(".homeCardsDots button").count()).toBe(2);
    const active = () => page.locator(".homeCardsDots button.is-on").evaluate((el) => [...el.parentElement.children].indexOf(el));
    const before = await active();
    await page.waitForFunction((was) => [...document.querySelectorAll(".homeCardsDots button")].findIndex((b) => b.classList.contains("is-on")) !== was, before, { timeout: 9000 });
    await page.locator(".homeCardsDots button").nth(before).dispatchEvent("click");
    await page.waitForTimeout(900);
    expect(await active()).toBe(before);
    await page.locator(".storyNudgeNo").dispatchEvent("click");
    await page.waitForTimeout(500);
    expect(await card(page).count()).toBe(0);
    expect(await page.locator(".homeCardsDots").count()).toBe(0);
    expect(await page.locator(".homeCardsTrack > section").count()).toBe(1);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("stays hidden after «×» for the rest of the day and comes back the next day", async () => {
    const { salon } = await teamSalon("Dismiss Salon", 1);
    await complete(salon.api);
    await pickDay(salon, 1);
    const { page, context, problems } = await openHome(salon);
    await card(page).waitFor();
    await page.locator(".storyNudgeNo").dispatchEvent("click");
    await page.waitForTimeout(400);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2500);
    expect(await card(page).count()).toBe(0);
    await page.evaluate(() => localStorage.setItem("frfro-story-nudge-day", "1400-01-01"));
    await page.reload({ waitUntil: "load" });
    await card(page).waitFor();
    expect(problems).toEqual([]);
    await context.close();
  });

  it("shows no card when nothing is free", async () => {
    const { salon } = await teamSalon("Closed Salon", 1);
    await complete(salon.api);
    const services = (await salon.api.get("/api/salon-services")).payload.data.services;
    for (const service of services) await salon.api.delete("/api/salon-services", { id: service.id });
    const { page, context, problems } = await openHome(salon);
    await page.waitForTimeout(3000);
    expect(await card(page).count()).toBe(0);
    expect(problems).toEqual([]);
    await context.close();
  });
});

describe("the story maker (browser)", () => {
  it("opens with frfro's suggestion: at most two days and four times a day, all marked, all changeable", async () => {
    const { salon } = await teamSalon("Maker Salon", 1);
    await complete(salon.api);
    await pickDay(salon, 4);
    const { page, context, problems } = await openHome(salon);
    await openMaker(page);

    await page.locator(".igStudioTools button", { hasText: "ساعت‌ها" }).dispatchEvent("click");
    const days = page.locator(".igDays button");
    expect(await days.count()).toBe(3);
    expect(await page.locator(".igDays button.is-on").count()).toBeGreaterThan(0);
    expect(await page.locator(".igDays button.is-on").count()).toBeLessThanOrEqual(2);
    const perDay = await page.locator(".igEditDay").evaluateAll((list) => list.map((d) => d.querySelectorAll("button.is-on").length));
    expect(perDay.every((n) => n >= 1 && n <= 4)).toBe(true);
    // Every time that starts on is frfro's suggestion.
    expect(await page.locator(".igEditChips button.is-on:not(.is-suggested)").count()).toBe(0);

    // A fifth time cannot be added to a full day; taking one off frees the others.
    const first = page.locator(".igEditDay").first();
    if ((await first.locator("button.is-on").count()) === 4) {
      expect(await first.locator("button:not(.is-on)").first().isDisabled()).toBe(true);
    }
    await first.locator("button.is-on").first().dispatchEvent("click");
    expect(await first.locator("button:not(.is-on)").first().isDisabled()).toBe(false);

    // Turning all three days on keeps two.
    for (let i = 0; i < 3; i += 1) {
      const button = days.nth(i);
      if (!(await button.isDisabled()) && !(await button.getAttribute("class"))?.includes("is-on")) await button.dispatchEvent("click");
    }
    expect(await page.locator(".igDays button.is-on").count()).toBeLessThanOrEqual(2);

    // «برگرد به پیشنهاد ما» puts the suggestion back.
    await page.locator(".igEditReset").dispatchEvent("click");
    expect(await page.locator(".igEditChips button.is-on:not(.is-suggested)").count()).toBe(0);
    await page.locator(".igStudioPicture img").first().waitFor();
    expect(problems).toEqual([]);
    await context.close();
  });

  it("draws every look, and the works look asks for three works when there are fewer", async () => {
    const { salon } = await teamSalon("Looks Salon", 1);
    await complete(salon.api);
    await pickDay(salon, 2);
    const { page, context, problems } = await openHome(salon);
    await openMaker(page);
    const dots = page.locator(".igLookDot");
    const n = await dots.count();
    // No works: night, rose, light and the works collage (the photo look needs a work).
    expect(n).toBe(4);
    for (let i = 0; i < n; i += 1) {
      await dots.nth(i).dispatchEvent("click");
      const slide = page.locator(".igStudioSlide").nth(i);
      await slide.locator("img, .igStudioNote").first().waitFor({ timeout: 20000 });
    }
    expect(await page.locator(".igStudioSlide").nth(n - 1).locator(".igStudioNote").innerText()).toContain("نمونه‌کار");
    // On the works look only «ظاهر» is offered, and the dot stays on it (the smooth scroll passes the other looks).
    await expect.poll(() => page.locator(".igStudioTools button").count(), { timeout: 5000 }).toBe(1);
    await page.waitForTimeout(800);
    expect(await page.locator(".igLookDot.is-on").getAttribute("class")).toContain("is-works");
    expect(await page.locator(".igStudioTools button").count()).toBe(1);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("shows the link guide first, saves from it, and the card rests for the rest of the day", async () => {
    const { salon } = await teamSalon("Guide Salon", 1);
    await complete(salon.api);
    await pickDay(salon, 2);
    const { page, context, problems } = await openHome(salon);
    await openMaker(page);
    await page.locator(".igStudioMain").first().dispatchEvent("click");
    await page.locator(".igGuide").waitFor();
    expect(await page.locator(".igGuideSteps li").count()).toBe(3);
    const download = page.waitForEvent("download", { timeout: 15000 });
    await page.locator(".igGuide .igStudioMain").dispatchEvent("click");
    await download;
    expect(await page.locator(".igGuide").count()).toBe(0);
    await page.locator(".igStudioClose").dispatchEvent("click");
    await page.waitForTimeout(800);
    expect(await card(page).count()).toBe(0);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2500);
    expect(await card(page).count()).toBe(0);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("stops the guide after three times, or at once on «دیگه نشونم نده»", async () => {
    const { salon } = await teamSalon("Guide Off Salon", 1);
    await complete(salon.api);
    await pickDay(salon, 2);
    const { page, context, problems } = await openHome(salon);
    await openMaker(page);
    await page.locator(".igStudioMain").first().dispatchEvent("click");
    await page.locator(".igGuide").waitFor();
    const download = page.waitForEvent("download", { timeout: 15000 });
    await page.locator(".igGuideOff").dispatchEvent("click");
    await download;
    // Next save goes straight through.
    const again = page.waitForEvent("download", { timeout: 15000 });
    await page.locator(".igStudioMain").first().dispatchEvent("click");
    await again;
    expect(await page.locator(".igGuide").count()).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem("frfro-story-guide"))).toBe("3");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("keeps its white text white in the night theme", async () => {
    const { salon } = await teamSalon("Night Salon", 1);
    await complete(salon.api);
    await pickDay(salon, 1);
    const { page, context, problems } = await openHome(salon, { dark: true, init: `localStorage.setItem("frfro-theme","dark");` });
    await openMaker(page);
    expect(await page.locator(".igStudioTitle").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
    expect(await card(page).count()).toBeGreaterThanOrEqual(0);
    expect(problems).toEqual([]);
    await context.close();
  });
});

describe("the story card on an artist's home (browser)", () => {
  it("offers the artist's free times and makes a story", async () => {
    const artist = await newArtist("Story Artist");
    await complete(artist.api);
    const client = await newClient("Artist Client");
    await directConfirmed(artist, client, { day: tomorrowKey(), time: "11:00" });
    const { page, context, problems } = await openHome(artist);
    await card(page).waitFor();
    expect(await card(page).innerText()).toContain("وقت خالی داری");
    await openMaker(page);
    expect(problems).toEqual([]);
    await context.close();
  });
});
