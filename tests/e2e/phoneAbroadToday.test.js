import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { newArtist } from "../integration/exitHelpers.js";
import { getTodayPersianWeekday } from "../../app/shared/lib/time.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const CLOSING = ["۱۲:۰۰", "۱۳:۰۰", "۱۴:۰۰", "۱۵:۰۰", "۱۶:۰۰", "۱۷:۰۰", "۱۸:۰۰"];
const weekdayIn = (timeZone) => new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(new Date());
/** These two are 25 hours apart, so at any moment at least one of them is on another day than Iran. */
const zoneOnAnotherDay = () => ["Pacific/Kiritimati", "Pacific/Pago_Pago"].find((zone) => weekdayIn(zone) !== weekdayIn("Asia/Tehran"));

describe("a phone set to another country's time (error report of 2026-11-07)", () => {
  it("reads the same «امروز» as the server, so the artist's page opens without a mismatch", async () => {
    const artist = await newArtist("آیلین مسافر");
    // Every day closes at its own hour, so a wrong «امروز» shows in the text.
    const rows = (await artist.api.get("/api/artist-hours")).payload.data.hours;
    const week = rows.map((row, index) => ({ day: row.day, openTime: "۱۰:۰۰", closeTime: CLOSING[index], active: true }));
    expect((await artist.api.patch("/api/artist-hours", { hours: week })).ok).toBe(true);
    const today = week.find((row) => row.day === getTodayPersianWeekday());

    const { page, context, problems } = await newPage({ timezoneId: zoneOnAnotherDay() });
    await page.goto(`${TEST_BASE_URL}/artists/${artist.id}`, { waitUntil: "networkidle" });

    expect(problems.filter((line) => /#418|#423|#425|hydrat/i.test(line))).toEqual([]);
    expect(await page.locator(".spvHoursToggle span").innerText()).toBe(`امروز ۱۰:۰۰ تا ${today.closeTime}`);
    await context.close();
  }, 90_000);
});
