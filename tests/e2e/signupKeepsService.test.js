import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser, uniquePhone } from "../integration/helpers.js";
import { closeBrowser, newPage } from "./browser.js";

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

/** A guest ticks the service on the public page, taps «رزرو …», and goes through the short client sign-up. */
async function guestPicksAndSignsUp(page, salonId, { beforeAccount } = {}) {
  await page.goto(`${TEST_BASE_URL}/salons/${salonId}`, { waitUntil: "networkidle" });
  await page.locator(".spvBarBook").click();
  await page.locator(".sduItem", { hasText: SERVICE }).click();
  await page.getByRole("button", { name: `رزرو «${SERVICE}»` }).click();
  await page.locator("[name=phone]").waitFor();
  await page.fill("[name=phone]", uniquePhone());
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await page.fill("[name=name]", "مشتری انتخاب");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await page.fill("[name=password]", "testpass123");
  if (beforeAccount) await beforeAccount();
  await page.getByRole("button", { name: "ساخت حساب" }).click();
}

describe("the service a guest picked survives sign-up (browser)", () => {
  it("opens the salon with the booking form on that service and «ادامه برای: …»", async () => {
    const { salon } = await seedSalon();
    const { page, context, problems } = await newPage({ entered: false });
    await guestPicksAndSignsUp(page, salon.user.id);
    await page.locator(".visitBookerSheet").waitFor();
    await page.getByText(`ادامه برای: ${SERVICE}`).waitFor({ state: "attached" });
    expect(await page.locator(".visitBookerSheet").innerText()).toContain(SERVICE);
    expect(problems).toEqual([]);
    await context.close();
  }, 90_000);

  it("says so when that service is gone, and offers to pick another", async () => {
    const { salon, salonClient, serviceId } = await seedSalon();
    const { page, context } = await newPage({ entered: false });
    await guestPicksAndSignsUp(page, salon.user.id, { beforeAccount: async () => { await salonClient.delete("/api/salon-services", { id: serviceId }); } });
    await page.getByText("این خدمت دیگر موجود نیست؛ یکی دیگر را انتخاب کن.").waitFor();
    expect(await page.locator(".visitBookerSheet").count()).toBe(0);
    await page.getByRole("button", { name: "انتخاب خدمت" }).click();
    await page.locator(".sduItem", { hasText: "رنگ مو" }).waitFor();
    await context.close();
  }, 90_000);
});
