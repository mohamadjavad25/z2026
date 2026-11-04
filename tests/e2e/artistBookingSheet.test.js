import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { newArtist, newClient } from "../integration/exitHelpers.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { ATTEND_NOTICE } from "../../app/shared/lib/attendance.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const DAY_MS = 24 * 60 * 60 * 1000;
const tomorrowKey = () => formatPersianDateKey(new Date(Date.now() + DAY_MS));

/** A client on the artist's web page (the link in a story) opens «نوبت بگیر» for the first service. */
async function openSheet(client, artist) {
  const opened = await newPage({ cookie: client.api.cookie() });
  opened.page.setDefaultTimeout(10000);
  await opened.page.goto(`${TEST_BASE_URL}/artists/${artist.id}`, { waitUntil: "networkidle" });
  await opened.page.locator(".spvBarBook").click();
  await opened.page.locator(".sduItem").first().click();
  await opened.page.locator(".sduConfirm").click();
  await opened.page.locator(".bspDay").first().waitFor();
  return opened;
}

describe("the artist's «نوبت بگیر» sheet, calmer (owner, 2026-11-04)", () => {
  it("shows one small line under «بفرست», and an artist with «تأیید خودکار» is settled on the spot", async () => {
    const artist = await newArtist("آیلین آرام");
    expect((await artist.api.post("/api/profile/settings", { autoConfirm: true })).ok).toBe(true);
    const client = await newClient("مشتری آرام");
    const { page, context, problems } = await openSheet(client, artist);
    const sheet = page.locator(".artistBookingPopupSheet");
    const text = await sheet.innerText();
    for (const gone of ["تا کار تموم نشه", "روزی که می‌خوای پره", "خدمت انتخاب‌شده", "انتخاب‌هات سر جاشه"]) {
      expect(text).not.toContain(gone);
    }
    // The attendance line comes right after the send button.
    expect(await sheet.locator(".artistBookingPopupConfirm + .artistPublicBookingNote").innerText()).toBe(ATTEND_NOTICE);
    await page.locator(".bspTime.is-selected").waitFor();
    await page.locator(".artistBookingPopupConfirm").click();
    await page.getByText("نوبتت قطعی شد").waitFor();
    expect(await page.locator(".fsDone").innerText()).toContain("آیلین منتظرته. قبلش یادت می‌ندازیم.");
    expect(problems).toEqual([]);
    await context.close();
  }, 90_000);

  it("a full day stays tappable and offers «خبرم کن» right there", async () => {
    const artist = await newArtist("آیلین پر");
    // Every day 09:00 to 10:00 (the week's rows are made on the first read, as the hours sheet does).
    const rows = (await artist.api.get("/api/artist-hours")).payload.data.hours;
    const week = rows.map((row) => ({ day: row.day, openTime: "۰۹:۰۰", closeTime: "۱۰:۰۰", active: true }));
    expect((await artist.api.patch("/api/artist-hours", { hours: week })).ok).toBe(true);
    const entry = await artist.api.post("/api/artist/me", {
      kind: "booking", clientName: "مهمان", clientPhone: "09120000000", service: "کوتاهی مو",
      bookingDate: tomorrowKey(), time: "09:00", durationMinutes: 60
    });
    expect(entry.ok).toBe(true);
    const client = await newClient("مشتری منتظر");
    const { page, context, problems } = await openSheet(client, artist);
    const tomorrow = page.locator(".bspDay").nth(1);
    expect(await tomorrow.getAttribute("class")).toContain("is-full");
    expect(await tomorrow.isEnabled()).toBe(true);
    await tomorrow.click();
    await page.locator(".plFullDay").waitFor();
    expect(await page.locator(".plFullDay b").innerText()).toMatch(/پره\.$/);
    expect(await page.locator(".bspTime").count()).toBe(0);
    expect(await page.locator(".artistBookingPopupConfirm").isDisabled()).toBe(true);
    await page.getByRole("button", { name: "اگه جا باز شد خبرم کن" }).click();
    await page.getByText("پیش آیلین جا خالی شد، همون لحظه خبرت می‌کنیم.", { exact: false }).waitFor();
    expect(problems).toEqual([]);
    await context.close();
  }, 90_000);
});
