/* eslint-env browser */
/* global document */
import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser } from "../integration/helpers.js";
import { closeBrowser, newPage } from "./browser.js";

const persian = /[؀-ۿ]/;
afterAll(closeBrowser);

async function seedSalon() {
  const name = `سالن تست ${Math.floor(Math.random() * 1e6)}`;
  const client = createClient();
  const salon = await registerUser(client, { type: "salon", name });
  await client.get("/api/salon-hours");
  await client.post("/api/salon-services", { name: "کوتاهی مو", price: "300000", duration: "45 دقیقه" });
  return { name, client, salon };
}

describe("auth forms (browser)", () => {
  it("shows Persian inline errors instead of the browser's own messages", async () => {
    const { page, context, problems } = await newPage();
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.getByText("سالن زیبایی", { exact: true }).first().click();
    await page.getByRole("button", { name: "تکمیل ثبت‌نام" }).click();
    const alerts = (await page.locator("[role=alert]").allInnerTexts()).filter(Boolean);
    expect(alerts.length).toBeGreaterThanOrEqual(5);
    for (const message of alerts) expect(message).toMatch(persian);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("name"))).toBe("name");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("explains a wrong password in Persian", async () => {
    const client = createClient();
    const user = await registerUser(client, { type: "client" });
    const { page, context } = await newPage();
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "ورود" }).last().click();
    await page.fill("[name=phone]", user.phone);
    await page.fill("[name=password]", "not-the-password");
    await page.getByRole("button", { name: "ورود", exact: true }).last().click();
    await page.getByRole("alert").filter({ hasText: persian }).first().waitFor();
    await context.close();
  });
});

describe("booking flow (browser)", () => {
  it("client books through the UI, salon confirms through the UI, client sees it confirmed", async () => {
    const { name, client: salonClient } = await seedSalon();
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری تست" });

    // client: find the salon and request a slot
    const clientView = await newPage({ cookie: clientApi.cookie() });
    const cp = clientView.page;
    await cp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await cp.locator("nav.bottomNav > button").nth(2).click();
    await cp.getByPlaceholder("جستجوی سالن یا محدوده...").fill(name);
    await cp.locator("article").filter({ hasText: name }).first().click();
    await cp.locator(".spvBarBook").click();
    await cp.locator(".bspTime").first().click();
    expect(await cp.locator(".salonClientBookingSummary").innerText()).toContain("ساعت");
    await cp.getByRole("button", { name: "ثبت درخواست نوبت" }).click();
    await cp.locator(".cbt.is-wait").waitFor();
    expect(await cp.locator(".cbt").innerText()).toContain("منتظر تأیید");
    expect(clientView.problems).toEqual([]);

    // salon: approve from the dashboard
    const salonView = await newPage({ cookie: salonClient.cookie() });
    const sp = salonView.page;
    await sp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await sp.locator(".reservationRequestCard").first().waitFor();
    await sp.getByRole("button", { name: "تایید" }).first().click();
    await sp.locator(".reservationRequestCard").first().waitFor({ state: "detached" });

    // the client's booking list now says confirmed
    const list = await clientApi.get("/api/client-bookings");
    const statuses = JSON.stringify(list.payload);
    expect(statuses).toContain("تایید شده");
    await clientView.context.close();
    await salonView.context.close();
  });
});

describe("mobile smoke (browser)", () => {
  it("every role renders at 360px with no horizontal scroll and no unnamed buttons", async () => {
    for (const type of ["client", "artist", "salon"]) {
      const api = createClient();
      await registerUser(api, { type, name: `نقش ${type}` });
      const { page, context, problems } = await newPage({ width: 360, cookie: api.cookie() });
      await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
      const nav = page.locator("nav.bottomNav > button");
      for (let i = 0; i < (await nav.count()); i++) {
        await nav.nth(i).click();
        await page.waitForTimeout(300);
        const report = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          unnamed: [...document.querySelectorAll("button,a")].filter((el) => el.getBoundingClientRect().width > 0 && !el.textContent.trim() && !el.getAttribute("aria-label") && !el.getAttribute("title")).length
        }));
        expect(report, `${type} tab ${i}`).toEqual({ overflow: false, unnamed: 0 });
      }
      expect(problems).toEqual([]);
      await context.close();
    }
  });
});
