/* global document, window */
import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser } from "../integration/helpers.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

describe("Back from a salon page (browser)", () => {
  it("lands on the same search text, the same results and the same scroll place", async () => {
    const name = `سالن برگشت ${Math.floor(Math.random() * 1e6)}`;
    const salonApi = createClient();
    await registerUser(salonApi, { type: "salon", name });
    await salonApi.get("/api/salon-hours");
    await salonApi.post("/api/salon-services", { name: "کوتاهی مو", price: "300000", duration: "45 دقیقه" });
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری برگشت" });

    const { page, context, problems } = await newPage({ cookie: clientApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.locator("nav.bottomNav > button").nth(2).click();
    await page.getByRole("tab", { name: "پیدا کردن" }).click();
    const box = page.locator("#cbt-panel").getByPlaceholder("اسم سالن یا آرتیست");

    // nothing matches: the empty text says what to do
    await box.fill("ناموجود-" + Math.floor(Math.random() * 1e6));
    await page.getByText("پیدا نشد؛ یه اسم دیگه امتحان کن.").waitFor();

    await box.fill(name);
    const card = page.locator(".cnCard").filter({ hasText: name }).first();
    await card.waitFor();
    await page.evaluate(() => { document.body.style.minHeight = "4000px"; window.scrollTo(0, 300); });
    await card.locator(".cnCardMain").click();
    await page.locator(".salonPublicProfile").waitFor();

    await page.getByRole("button", { name: "برگرد" }).click();
    await page.locator(".cnCard").filter({ hasText: name }).first().waitFor();
    expect(await box.inputValue()).toBe(name);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(200);
    expect(problems).toEqual([]);
    await context.close();
  }, 90_000);
});
