/* global document, axe */
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
    await page.getByText("سالن", { exact: true }).first().click();
    await page.getByRole("button", { name: "تکمیل ثبت‌نام" }).click();
    const alerts = (await page.locator("[role=alert]").allInnerTexts()).filter(Boolean);
    // name, phone, password, terms: signup is intentionally short
    expect(alerts.length).toBeGreaterThanOrEqual(4);
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

    // client: find the salon in «سالن و آرتیست من», connect, open it and request a slot
    const clientView = await newPage({ cookie: clientApi.cookie() });
    const cp = clientView.page;
    await cp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await cp.locator("nav.bottomNav > button").nth(2).click();
    await cp.getByPlaceholder("شماره، اسم یا لینک صفحه").fill(name);
    const result = cp.locator(".cnCard").filter({ hasText: name }).first();
    await result.getByRole("button", { name: "وصل شو" }).click();
    await result.getByRole("button", { name: "رزرو" }).waitFor();
    await cp.getByRole("button", { name: "پاک کردن جستجو" }).click();
    await cp.locator(".cnCard").filter({ hasText: name }).first().getByRole("button", { name: `باز کردن ${name}` }).click();
    await cp.locator(".spvBarBook").click();
    await cp.locator(".sduItem").first().click();
    await cp.locator(".sduConfirm").click();
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

describe("accessibility (browser)", () => {
  it("has no serious or critical axe violations on the main screens of every role", async () => {
    const axePath = new URL("../../node_modules/axe-core/axe.min.js", import.meta.url).pathname;
    for (const type of ["client", "artist", "salon"]) {
      const api = createClient();
      await registerUser(api, { type, name: `نقش ${type}` });
      const { page, context } = await newPage({ cookie: api.cookie() });
      await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
      const nav = page.locator("nav.bottomNav > button");
      for (let i = 0; i < (await nav.count()); i++) {
        await nav.nth(i).click();
        await page.waitForTimeout(400);
        await page.addScriptTag({ path: axePath });
        const violations = await page.evaluate(async () => {
          const result = await axe.run(document, { resultTypes: ["violations"] });
          return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`);
        });
        expect(violations, `${type} tab ${i}`).toEqual([]);
      }
      await context.close();
    }
  }, 120_000);

  it("keeps keyboard focus inside a sheet and returns it to the opener on Escape", async () => {
    // The specialty picker lives in the profile edit sheet (signup no longer asks for it).
    const api = createClient();
    await registerUser(api, { type: "salon", name: "سالن فوکوس" });
    const { page, context } = await newPage({ cookie: api.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.locator("nav.bottomNav > button").nth(0).click();
    await page.locator("main button").filter({ hasText: "ویرایش برند سالن" }).first().click();
    const trigger = page.locator(".specialtySelectTrigger");
    await trigger.waitFor();
    await trigger.focus();
    await trigger.press("Enter");
    await page.locator(".specialtySheet").waitFor();
    await settleAnimations(page);
    expect(await page.evaluate(() => !!document.activeElement?.closest(".specialtySheet"))).toBe(true);
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".specialtySheet"))).toBe(true);
    await page.keyboard.press("Escape");
    await page.locator(".specialtySheet").waitFor({ state: "detached" });
    expect(await page.evaluate(() => document.activeElement?.className || "")).toContain("specialtySelectTrigger");
    await context.close();
  });
});

describe("profile completeness (browser)", () => {
  it("shows a new salon what is missing, and stays dismissed once closed", async () => {
    const api = createClient();
    await registerUser(api, { type: "salon", name: "سالن ناقص" });
    const { page, context } = await newPage({ cookie: api.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const card = page.locator(".profileCompleteness");
    await card.waitFor();
    expect(await card.innerText()).toContain("اولین خدمت در منو");
    await page.getByRole("button", { name: "بستن یادآوری تکمیل پروفایل" }).click();
    await card.waitFor({ state: "detached" });
    await page.reload({ waitUntil: "networkidle" });
    expect(await page.locator(".profileCompleteness").count()).toBe(0);
    await context.close();
  });
});


// Finite animations only (a looping one never finishes), capped so a stuck one cannot hang the test.
async function settleAnimations(page) {
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      .map((a) => a.finished.catch(() => {}))),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]));
}

describe("dialogs (browser)", () => {
  it("the main owner dialogs have no serious or critical axe violations", async () => {
    const axePath = new URL("../../node_modules/axe-core/axe.min.js", import.meta.url).pathname;
    const checks = [
      ["artist", "رزرو دستی", (page) => page.locator("button.is-createBooking").click()],
      ["artist", "افزودن خدمت", async (page) => {
        await page.locator(".profileModeRail button", { hasText: "خدمات" }).click();
        await page.getByRole("button", { name: /افزودن خدمت/ }).first().click();
      }],
      ["artist", "ایجاد پست", async (page) => {
        await page.locator(".profileModeRail button", { hasText: "نمونه‌کار" }).click();
        await page.getByRole("button", { name: /ایجاد پست/ }).first().click();
      }],
      ["salon", "ویرایش پروفایل", async (page) => {
        await page.locator("nav.bottomNav > button").nth(0).click();
        await page.locator("main button").filter({ hasText: "ویرایش برند سالن" }).first().click();
      }]
    ];
    for (const [type, label, open] of checks) {
      const api = createClient();
      await registerUser(api, { type, name: `دیالوگ ${type}` });
      const { page, context } = await newPage({ cookie: api.cookie() });
      await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
      await open(page);
      await page.locator("[role=dialog]").last().waitFor();
      // axe reads colours as rendered: let the opening animation finish or it measures a half-faded dialog.
      await settleAnimations(page);
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => {
        const dialogs = document.querySelectorAll("[role=dialog]");
        const result = await axe.run(dialogs[dialogs.length - 1], { resultTypes: ["violations"] });
        return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`);
      });
      expect(violations, `${type} ${label}`).toEqual([]);
      await context.close();
    }
  }, 120_000);
});

describe("admin page (browser)", () => {
  it("shows only a login form to anyone without an admin session, then walks the real setup and login flow", async () => {
    const { TEST_ADMIN3_PHONE, TEST_ADMIN_PASSWORD, TEST_ADMIN_SETUP_KEY } = await import("../globalSetup.js");
    const { totpCodeAt, totpStepAt } = await import("../../app/lib/totp.js");

    // A normal user's login opens nothing: /admin shows the admin login form, never the panel.
    const normal = createClient();
    await registerUser(normal, { type: "client", name: "عادی" });
    const denied = await newPage({ cookie: normal.cookie() });
    await denied.page.goto(`${TEST_BASE_URL}/admin`, { waitUntil: "networkidle" });
    expect(await denied.page.locator("main").innerText()).toContain("ورود مدیریت");
    expect(await denied.page.locator(".admTabs").count()).toBe(0);
    await denied.context.close();

    await registerUser(createClient(), { type: "client", name: "Admin Three", phone: TEST_ADMIN3_PHONE });
    const { page, context, problems } = await newPage({ width: 1100 });
    await page.goto(`${TEST_BASE_URL}/admin`, { waitUntil: "networkidle" });

    // First-time setup: password + setup key -> QR/secret -> first code -> inside the panel.
    await page.getByRole("button", { name: /راه‌اندازی اولیه/ }).click();
    await page.getByLabel("شمارهٔ موبایل").fill(TEST_ADMIN3_PHONE);
    await page.getByLabel("رمز عبور").fill(TEST_ADMIN_PASSWORD);
    await page.getByLabel(/کلید راه‌اندازی/).fill(TEST_ADMIN_SETUP_KEY);
    await page.getByRole("button", { name: "ادامه" }).click();
    await page.locator(".admKey").waitFor();
    const secret = (await page.locator(".admKey").innerText()).trim();
    const usedStep = totpStepAt();
    await page.getByLabel("کد ۶ رقمی").fill(totpCodeAt(secret, usedStep));
    await page.getByRole("button", { name: "فعال‌سازی و ورود" }).click();
    await page.getByRole("tab", { name: "کاربران" }).waitFor();
    await page.getByRole("tab", { name: "کاربران" }).click();
    await page.locator(".admTable tbody tr").first().waitFor();
    await page.getByRole("tab", { name: "نمای کلی" }).click();
    expect(await page.locator(".admGrid").innerText()).toContain("کل کاربران");

    // The left rail starts as icons only, and opens/closes from its top button.
    const rail = page.locator(".admSide");
    expect(await rail.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThan(100);
    await page.getByRole("button", { name: "باز‌کردن منو" }).click();
    await page.waitForFunction(() => document.querySelector(".admSide").getBoundingClientRect().width > 200);
    await page.getByRole("button", { name: "جمع‌کردن منو" }).click();

    // The other panels open without errors.
    for (const tabName of ["محتوا", "رزروها", "پشتیبانی", "امنیت"]) {
      await page.getByRole("tab", { name: tabName }).click();
      await page.locator(".admCard").first().waitFor();
    }
    expect(await page.locator("main").innerText()).toContain("نشست‌های فعال مدیریت");
    await page.getByRole("tab", { name: "کاربران" }).click();
    await page.locator(".admTable tbody .admLink").first().click();
    await page.locator(".admDetail").waitFor();
    // On a narrow screen the details cover the page; "back to list" closes them.
    const back = page.locator(".admSplitBack");
    if (await back.isVisible()) await back.click();

    // Logout, then a normal login with the next code.
    await page.getByRole("button", { name: "خروج" }).click();
    await page.getByRole("button", { name: "ورود", exact: true }).waitFor();
    await page.getByLabel("شمارهٔ موبایل").fill(TEST_ADMIN3_PHONE);
    await page.getByLabel("رمز عبور").fill(TEST_ADMIN_PASSWORD);
    await page.getByLabel(/کد ۶ رقمی/).fill(totpCodeAt(secret, usedStep + 1));
    await page.getByRole("button", { name: "ورود", exact: true }).click();
    await page.getByRole("tab", { name: "نمای کلی" }).waitFor();
    expect(problems).toEqual([]);
    await context.close();
  }, 60_000);
});

describe("support (browser)", () => {
  it("a user writes to support from the floating button, gets the admin's reply with an unread badge, and keeps talking", async () => {
    const { adminClient } = await import("../integration/helpers.js");
    const axePath = new URL("../../node_modules/axe-core/axe.min.js", import.meta.url).pathname;
    const userApi = createClient();
    await registerUser(userApi, { type: "client", name: "کاربر پشتیبانی" });
    const { page, context, problems } = await newPage({ cookie: userApi.cookie() });

    // The floating button is there; open the centre and write a new message.
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "پشتیبانی", exact: true }).click();
    const center = page.getByRole("dialog", { name: "پشتیبانی" });
    await center.waitFor();
    await settleAnimations(page);
    await page.addScriptTag({ path: axePath });
    const axeIssues = () => page.evaluate(async () => {
      const result = await axe.run(document.querySelector(".scSheet"), { resultTypes: ["violations"] });
      return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`);
    });
    expect(await axeIssues()).toEqual([]);
    await center.getByRole("button", { name: /پیام جدید به پشتیبانی/ }).click();
    await center.getByLabel("پیامت").fill("سلام، این یک پیام آزمایشی از مرورگر برای پشتیبانی است.");
    await center.getByRole("button", { name: "ارسال پیام" }).click();
    await center.getByText("سلام، این یک پیام آزمایشی از مرورگر برای پشتیبانی است.").waitFor();
    expect(await axeIssues()).toEqual([]);

    // The admin answers; after a reload the button shows an unread badge and the reply is in the conversation.
    const admin = await adminClient();
    const inbox = (await admin.get("/api/admin/support?kind=support&q=" + encodeURIComponent("پیام آزمایشی از مرورگر"))).payload.data;
    expect(inbox.tickets.length).toBeGreaterThan(0);
    expect((await admin.post(`/api/admin/support/${inbox.tickets[0].id}`, { reply: "سلام! مشکل را بررسی کردیم." })).ok).toBe(true);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /پشتیبانی، 1 پاسخ جدید/ }).click();
    await page.getByRole("dialog", { name: "پشتیبانی" }).getByText("پاسخ داده شد").first().waitFor();
    await page.locator(".scList button").first().click();
    await page.getByText("سلام! مشکل را بررسی کردیم.").waitFor();
    await settleAnimations(page);
    await page.addScriptTag({ path: axePath });
    expect(await axeIssues()).toEqual([]);

    // Keep the conversation going.
    await page.getByLabel("پیام", { exact: true }).fill("ممنون، حل شد.");
    await page.getByRole("button", { name: "ارسال", exact: true }).click();
    await page.getByText("ممنون، حل شد.").waitFor();
    expect(problems).toEqual([]);
    await context.close();
    const after = (await admin.get(`/api/admin/support/${inbox.tickets[0].id}`)).payload.data;
    expect(after.messages.map((message) => message.author)).toEqual(["user", "admin", "user"]);
  }, 90_000);
});

describe("SMS code at sign-up (browser)", () => {
  it("asks for the texted code, then creates the account", async () => {
    const { adminClient, uniquePhone } = await import("../integration/helpers.js");
    const admin = await adminClient();
    const phone = uniquePhone();
    const { page, context, problems } = await newPage();
    // Pretend sign-up requires a code (the shared test server leaves it optional).
    await page.route("**/api/auth/otp/config", (route) => route.fulfill({ json: { data: { enabled: true, required: true, resendSeconds: 60 } } }));
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.getByText("مشتری", { exact: true }).first().click();
    await page.fill("[name=name]", "مشتری کدی");
    await page.fill("[name=area]", "تهران");
    await page.fill("[name=phone]", phone);
    await page.fill("[name=password]", "testpass123");
    await page.locator("[name=agreeTerms]").check();
    await page.getByRole("button", { name: "ادامه و تأیید شماره" }).click();
    await page.locator("[name=otpCode]").waitFor();
    // wrong code first: Persian error, still on the code step
    await page.fill("[name=otpCode]", "00000");
    await page.getByRole("button", { name: "تأیید و ساخت حساب" }).click();
    await page.getByRole("alert").filter({ hasText: persian }).first().waitFor();
    // the real code
    let code = null;
    for (let i = 0; i < 20 && !code; i += 1) {
      code = (await admin.get(`/api/admin/sms?phone=${phone}`)).payload.data.latestTestCode;
      if (!code) await page.waitForTimeout(250);
    }
    await page.fill("[name=otpCode]", code);
    await page.getByRole("button", { name: "تأیید و ساخت حساب" }).click();
    await page.locator("nav.bottomNav").waitFor();
    const me = await page.evaluate(async () => (await (await fetch("/api/auth/me")).json()).data.user?.phone);
    expect(me).toBe(phone);
    expect(problems).toEqual([]);
    await context.close();
  });
});
