import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser, uniquePhone } from "../integration/helpers.js";
import { clientToTicket, closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const SERVICE = "کوتاهی مو";

async function seedSalon() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: `سالن انتخاب ${Math.floor(Math.random() * 1e6)}` });
  await salonClient.get("/api/salon-hours");
  const created = await salonClient.post("/api/salon-services", { name: SERVICE, price: "300", duration: "۳۰ دقیقه" });
  await salonClient.post("/api/salon-services", { name: "رنگ مو", price: "900", duration: "۹۰ دقیقه" });
  return { salonClient, salon, serviceId: created.payload.data.service.id };
}

/**
 * A guest (owner's decision 2026-11-02: pick everything first, sign up last) ticks the service on the public page,
 * goes through day and time to the ticket without an account, taps «بفرست», and makes the account in the sheet.
 */
async function guestPicksThenSignsUp(page, salonId, { beforeAccount } = {}) {
  await page.goto(`${TEST_BASE_URL}/salons/${salonId}`, { waitUntil: "networkidle" });
  await page.locator(".spvBarBook").click();
  await page.locator(".sduItem", { hasText: SERVICE }).click();
  await page.getByRole("button", { name: `رزرو «${SERVICE}»` }).click();
  await page.locator(".visitBookerSheet").waitFor();
  await clientToTicket(page);
  await page.getByRole("button", { name: /^بفرست/ }).click();
  await page.locator("[name=phone]").waitFor();
  await page.fill("[name=phone]", uniquePhone());
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await page.fill("[name=name]", "مشتری انتخاب");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await page.fill("[name=password]", "testpass123");
  if (beforeAccount) await beforeAccount();
  await page.getByRole("button", { name: "بساز و درخواست رو بفرست" }).click();
}

async function salonBookings(salonClient) {
  return (await salonClient.get("/api/salon-bookings")).payload.data.bookings;
}

describe("what a guest picked survives sign-up (browser)", () => {
  it("sends the request for that service right after the account is made, nothing picked again", async () => {
    const { salon, salonClient } = await seedSalon();
    const { page, context, problems } = await newPage({ entered: false });
    await guestPicksThenSignsUp(page, salon.user.id);
    await page.getByText("درخواستت رفت").waitFor();
    const bookings = await salonBookings(salonClient);
    expect(bookings).toHaveLength(1);
    expect(bookings[0].service).toBe(SERVICE);
    expect(bookings[0].status).toBe("درخواست");
    expect(problems).toEqual([]);
    await context.close();
  }, 90_000);

  it("says so when that service is gone by the time the account is made, and sends nothing", async () => {
    const { salon, salonClient, serviceId } = await seedSalon();
    const { page, context } = await newPage({ entered: false });
    await guestPicksThenSignsUp(page, salon.user.id, { beforeAccount: async () => { await salonClient.delete("/api/salon-services", { id: serviceId }); } });
    await page.getByText(`«${SERVICE}» توی کارهای این سالن نیست`).first().waitFor();
    expect(await page.getByText("درخواستت رفت").count()).toBe(0);
    expect(await salonBookings(salonClient)).toHaveLength(0);
    await context.close();
  }, 90_000);
});
