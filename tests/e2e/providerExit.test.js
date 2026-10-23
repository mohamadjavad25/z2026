import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { FAR_DAY, confirmedAt, moveSalonBookingNear, newClient, newSalon, q, salonRow } from "../integration/exitHelpers.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

/** The screens of the owner's rules of 2026-10-22, in a real phone-sized browser. */
describe("proposals and leaving (browser)", () => {
  it("the client sees the proposal on the home strip and on the booking, and «قبول می‌کنم» moves it", async () => {
    const salon = await newSalon("Browser Proposal Salon");
    const client = await newClient("Browser Proposal Client");
    expect((await client.api.post("/api/connections", { targetUserId: salon.id })).ok).toBe(true);
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "14:00" })).ok).toBe(true);

    const view = await newPage({ cookie: client.api.cookie() });
    const page = view.page;
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const strip = page.locator(".cbt.is-offer");
    await strip.waitFor();
    expect(await strip.innerText()).toContain("می‌خواهد نوبتت را جابه‌جا کند");
    await strip.click();
    const card = page.locator(".cbProposal");
    await card.waitFor();
    const text = await card.innerText();
    expect(text).toContain("می‌خواهد نوبتت را از ۱۱ به ۱۴ ببرد. قبول می‌کنی؟");
    expect(text).toContain("تا وقتی قبول نکنی، نوبتت همان‌طور که بود می‌ماند.");
    for (const label of ["قبول می‌کنم", "لغو نوبت، بدون هیچ مشکلی", "تماس با سالن"]) {
      expect(await card.getByRole("button", { name: label }).count()).toBe(1);
    }
    await card.getByRole("button", { name: "قبول می‌کنم" }).click();
    await card.waitFor({ state: "detached" });
    expect((await salonRow(id)).time).toBe("14:00");
    expect(view.problems).toEqual([]);
    await view.context.close();
  });

  it("the client sees «سالن دیگر در فرفرو نیست» after the salon is deleted", async () => {
    const salon = await newSalon("Browser Gone Salon");
    const client = await newClient("Browser Gone Client");
    expect((await client.api.post("/api/connections", { targetUserId: salon.id })).ok).toBe(true);
    await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    expect((await salon.api.delete("/api/profile", { currentPassword: salon.password, cancelAll: true })).ok).toBe(true);

    const view = await newPage({ cookie: client.api.cookie() });
    await view.page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const note = view.page.locator(".cvMsg", { hasText: "سالن دیگر در فرفرو نیست" });
    await note.waitFor();
    await note.click();
    await view.page.locator(".cbGone", { hasText: "سالن دیگر در فرفرو نیست" }).waitFor();
    expect(view.problems).toEqual([]);
    await view.context.close();
  });

  it("the salon cancelling a booking that starts within 24 hours is told to call first, with the client's number", async () => {
    const salon = await newSalon("Browser Cancel Salon");
    const client = await newClient("Browser Cancel Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    await moveSalonBookingNear(id, 25); // later today, so it is on the schedule's first day

    const view = await newPage({ cookie: salon.api.cookie() });
    const page = view.page;
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    // open the booking from the salon's schedule
    await page.getByText("Browser Cancel Client").locator("visible=true").first().click({ timeout: 8000 }).catch(async (e) => { throw new Error(`${e.message}\n${(await page.locator("body").innerText()).slice(0, 900)}`); });
    const screen = page.locator(".sbmScreen");
    await screen.waitFor();
    expect(await screen.locator(".sbmBar").getByRole("button", { name: "پیشنهاد ساعت دیگر" }).count()).toBe(1);
    await screen.getByRole("button", { name: "لغو این رزرو" }).click();
    const panel = screen.locator(".pxCancelPanel");
    await panel.waitFor();
    expect(await panel.innerText()).toContain("اول با مشتری تماس بگیر. بعد لغو کن.");
    expect(await panel.getByRole("link", { name: /تماس با مشتری/ }).getAttribute("href")).toBe(`tel:${client.phone}`);
    await panel.getByRole("button", { name: "لغو با اطلاع مشتری" }).click();
    await screen.waitFor({ state: "detached" });
    expect((await salonRow(id)).status).toBe("لغو");
    expect(view.problems).toEqual([]);
    await view.context.close();
  });

  it("deleting the account with a booking in 10 hours shows the list with «تماس با مشتری» and «لغو با اطلاع مشتری»", async () => {
    const salon = await newSalon("Browser Delete Salon");
    const client = await newClient("Browser Delete Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    await moveSalonBookingNear(id, 600);

    const view = await newPage({ cookie: salon.api.cookie() });
    const page = view.page;
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.locator("nav.bottomNav").getByRole("button", { name: "تنظیمات" }).click();
    await page.getByRole("button", { name: "حذف حساب" }).click();
    const confirm = page.locator(".neoSettingsDeleteConfirm");
    await confirm.locator("input").first().fill("حذف");
    await confirm.locator("input[type=password]").fill(salon.password);
    await confirm.getByRole("button", { name: "تایید حذف حساب" }).click();
    const panel = confirm.locator(".pxPanel");
    await panel.waitFor();
    const text = await panel.innerText();
    expect(text).toContain("۱ مشتری تا ۲۴ ساعت دیگر نوبت دارند. تا زمانی که این نوبت‌ها انجام یا لغو نشوند نمی‌شود حساب را حذف کرد.");
    expect(text).toContain("Browser Delete Client");
    expect(await panel.getByRole("link", { name: /تماس با مشتری/ }).count()).toBe(1);
    // the delete button stays shut while a booking blocks it
    expect(await confirm.getByRole("button", { name: "تایید حذف حساب" }).isDisabled()).toBe(true);
    await panel.getByRole("button", { name: "لغو با اطلاع مشتری" }).click();
    await panel.getByRole("button", { name: "بله، لغو شود" }).click();
    await panel.getByText("نوبت تأییدشده‌ای جلوی این کار نمانده.").waitFor();
    expect(await confirm.getByRole("button", { name: "تایید حذف حساب" }).isDisabled()).toBe(false);
    expect((await salonRow(id)).cancelled_by).toBe("provider");
    expect((await q("SELECT 1 FROM users WHERE id = $1", [salon.id])).length).toBe(1);
    expect(view.problems).toEqual([]);
    await view.context.close();
  });
});

