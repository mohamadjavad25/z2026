import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { confirmedAt, directConfirmed, newArtist, newClient, teamSalon } from "../integration/exitHelpers.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { getTehranClockMinutes, timeLabelToMinutes } from "../../app/shared/lib/time.js";
import { toAsciiDigits as toAscii, toPersianDigits } from "../../app/shared/lib/digits.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const DAY_MS = 24 * 60 * 60 * 1000;
const todayKey = () => formatPersianDateKey(new Date());
const tomorrowKey = () => formatPersianDateKey(new Date(Date.now() + DAY_MS));

/** The calm story card on an owner's home, in a real phone-sized browser against the real app and database (owner's
 *  request 2026-10-31: try every case, push on it, then make it smarter). */
async function complete(api, extra = {}) {
  const res = await api.post("/api/profile", { data: { avatar: PNG, service: "مو", area: "تهران، خیابان گلستان", geo: { lat: 35.7219, lng: 51.3347 }, ...extra } });
  expect(res.ok).toBe(true);
}

/** The salon's shortest service: the card (like the story) reads free times for it. */
async function shortestService(salon) {
  const services = (await salon.api.get("/api/salon-services")).payload.data.services;
  const minutes = (service) => Number(String(toAscii(service.duration)).match(/\d+/)?.[0]) || Infinity;
  return [...services].sort((a, b) => minutes(a) - minutes(b))[0].name;
}

/** Free start times a client could still request, for one day, straight from the server. */
async function freeTimes(salon, day, service = "کوتاهی مو") {
  const query = new URLSearchParams({ salonUserId: String(salon.id), day });
  query.append("service", service);
  const res = await salon.api.get(`/api/salon-bookings/availability?${query}`);
  return res.payload?.data?.times || [];
}

/** A day (tomorrow first) with at least `need` free times, and the first `need` of them. */
async function pickDay(salon, need = 1) {
  for (const day of [tomorrowKey(), todayKey()]) {
    const times = (await freeTimes(salon, day)).filter((time) => day !== todayKey() || timeLabelToMinutes(time) - getTehranClockMinutes() > 150);
    if (times.length >= need + 2) return { day, times };
  }
  throw new Error("no day with free times");
}

async function openHome(client, { init = "" } = {}) {
  const opened = await newPage({ cookie: client.api.cookie() });
  if (init) await opened.context.addInitScript({ content: init });
  // Nothing outside the app (fonts, maps) may hold the page back where the network is closed.
  await opened.context.route((url) => !url.href.startsWith(TEST_BASE_URL) && !url.href.startsWith("data:"), (route) => route.abort());
  opened.page.setDefaultTimeout(12000);
  await opened.page.goto(TEST_BASE_URL, { waitUntil: "load" });
  return opened;
}

const card = (page) => page.locator(".storyNudge");

describe("the story card on a salon's home (browser)", () => {
  it("offers the free times, then names a cancelled booking with its team member and the time left", async () => {
    const { salon, members } = await teamSalon("Story Salon", 2);
    await complete(salon.api);
    const { day, times } = await pickDay(salon, 2);
    const client = await newClient("Story Client");
    const id = await confirmedAt(salon, client, { day, time: times[0], staff: members[0].staff.name });

    const first = await openHome(salon);
    await card(first.page).waitFor();
    expect(await card(first.page).innerText()).toContain("وقت خالی داری");
    expect(first.problems).toEqual([]);
    await first.context.close();

    expect((await salon.api.patch("/api/salon-bookings", { id, status: "لغو" })).ok).toBe(true);
    const second = await openHome(salon);
    await card(second.page).waitFor();
    const text = await card(second.page).innerText();
    expect(text).toContain(`نوبت Story`);
    expect(text).toContain(toPersianDigits(times[0]));
    expect(text).toContain("لغو شد");
    expect(text).toContain("مونده");
    expect(await card(second.page).getAttribute("class")).toContain("is-freed");
    expect(second.problems).toEqual([]);
    await second.context.close();
  });

  it("does not call a time «freed» when somebody booked it again", async () => {
    const { salon } = await teamSalon("Rebook Salon", 1);
    await complete(salon.api);
    const { day, times } = await pickDay(salon, 2);
    const one = await newClient("Rebook One");
    const two = await newClient("Rebook Two");
    const id = await confirmedAt(salon, one, { day, time: times[0] });
    expect((await salon.api.patch("/api/salon-bookings", { id, status: "لغو" })).ok).toBe(true);
    await confirmedAt(salon, two, { day, time: times[0] });
    const { page, context, problems } = await openHome(salon);
    await card(page).waitFor();
    const text = await card(page).innerText();
    expect(text).not.toContain("لغو شد");
    expect(text).toContain("وقت خالی داری");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("stays quiet about times already on today's story, and calls the others «تازه»", async () => {
    const { salon } = await teamSalon("Posted Salon", 1);
    await complete(salon.api);
    const { day } = await pickDay(salon, 2);
    const all = [];
    const shortest = await shortestService(salon);
    for (const key of [todayKey(), tomorrowKey()]) for (const time of await freeTimes(salon, key, shortest)) all.push(`${key}|${time}`);
    expect(all.length).toBeGreaterThan(2);

    const quiet = await openHome(salon, { init: `localStorage.setItem("frfro-story-posted", ${JSON.stringify(JSON.stringify(all))});` });
    await quiet.page.waitForTimeout(2500);
    expect(await card(quiet.page).count()).toBe(0);
    await quiet.context.close();

    // One time left out of the story: only that one is news.
    const left = all.find((entry) => entry.startsWith(`${day}|`));
    const partial = all.filter((entry) => entry !== left);
    const news = await openHome(salon, { init: `localStorage.setItem("frfro-story-posted", ${JSON.stringify(JSON.stringify(partial))});` });
    await card(news.page).waitFor();
    expect(await card(news.page).innerText()).toContain("تازه");
    await news.context.close();
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
    // Auto-moves within a few seconds (it waits five).
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

  it("after the story is saved, nothing is news until a booked time is freed later", async () => {
    const { salon } = await teamSalon("Post Salon", 1);
    await complete(salon.api);
    const { day, times } = await pickDay(salon, 2);
    const client = await newClient("Post Client");
    const id = await confirmedAt(salon, client, { day, time: times[0] });

    const { page, context, problems } = await openHome(salon);
    await card(page).waitFor();
    await page.locator(".storyNudgeMain").dispatchEvent("click");
    await page.locator(".igStudioPicture img").first().waitFor({ timeout: 20000 });
    const download = page.waitForEvent("download", { timeout: 15000 });
    await page.locator(".igStudioMain").dispatchEvent("click");
    await download;
    await page.locator(".igStudioClose").dispatchEvent("click");
    await page.waitForTimeout(800);
    // Everything free was told: the card steps aside, also for the times left off the picture.
    expect(await card(page).count()).toBe(0);

    // Later the booked time is freed: that is news.
    expect((await salon.api.patch("/api/salon-bookings", { id, status: "لغو" })).ok).toBe(true);
    await page.reload({ waitUntil: "load" });
    await card(page).waitFor();
    const text = await card(page).innerText();
    expect(text).toContain("لغو شد");
    expect(text).toContain(toPersianDigits(times[0]));
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

  it("shows no card when nothing is free (a closed day, a full book)", async () => {
    const { salon } = await teamSalon("Closed Salon", 1);
    await complete(salon.api);
    // No services listed: no time can be offered.
    const services = (await salon.api.get("/api/salon-services")).payload.data.services;
    for (const service of services) await salon.api.delete("/api/salon-services", { id: service.id });
    const { page, context, problems } = await openHome(salon);
    await page.waitForTimeout(3000);
    expect(await card(page).count()).toBe(0);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("holds up when many bookings are cancelled at once", async () => {
    const { salon } = await teamSalon("Crowd Salon", 3);
    await complete(salon.api);
    const { day, times } = await pickDay(salon, 6);
    const ids = [];
    const clients = [];
    for (let i = 0; i < 6; i += 1) clients.push(await newClient(`Crowd Client ${i}`));
    for (let i = 0; i < 6; i += 1) ids.push(await confirmedAt(salon, clients[i], { day, time: times[i] }));
    const results = await Promise.all(ids.map((id) => salon.api.patch("/api/salon-bookings", { id, status: "لغو" })));
    expect(results.every((res) => res.ok)).toBe(true);
    for (let round = 0; round < 3; round += 1) {
      const { page, context, problems } = await openHome(salon);
      await card(page).waitFor();
      expect(await card(page).innerText()).toContain("لغو شد");
      expect(await card(page).innerText()).toContain(toPersianDigits(6));
      expect(problems).toEqual([]);
      await context.close();
    }
  });
});

describe("the story card on an artist's home (browser)", () => {
  it("finds a booking that disappeared since the last visit and says its time is free", async () => {
    const artist = await newArtist("Vanish Artist");
    await complete(artist.api);
    const client = await newClient("Vanish Client");
    const day = tomorrowKey();
    const id = await directConfirmed(artist, client, { day, time: "11:00" });

    const opened = await openHome(artist);
    await card(opened.page).waitFor();
    expect(await card(opened.page).innerText()).toContain("وقت خالی داری");

    // Cancelled elsewhere while the app is closed (the phone remembers what it saw).
    expect((await artist.api.patch("/api/artist/me", { kind: "booking", id, status: "لغو", action: "cancel" })).ok).toBe(true);
    await opened.page.reload({ waitUntil: "load" });
    await card(opened.page).waitFor();
    const text = await card(opened.page).innerText();
    expect(text).toContain("آزاد شد");
    expect(text).toContain(toPersianDigits("11:00"));
    expect(opened.problems).toEqual([]);
    await opened.context.close();
  });
});

describe("what the card relies on from the server", () => {
  it("a cancelled time is offered again and a booked one is not", async () => {
    const { salon } = await teamSalon("Server Salon", 1);
    const { day, times } = await pickDay(salon, 2);
    const client = await newClient("Server Client");
    const id = await confirmedAt(salon, client, { day, time: times[0] });
    expect(await freeTimes(salon, day)).not.toContain(times[0]);
    expect((await salon.api.patch("/api/salon-bookings", { id, status: "لغو" })).ok).toBe(true);
    expect(await freeTimes(salon, day)).toContain(times[0]);
  });
});
