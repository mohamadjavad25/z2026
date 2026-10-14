import { chromium } from "playwright";
import { TEST_BASE_URL } from "../globalSetup.js";

/** One shared headless Chromium for the e2e files (CI installs it with `npx playwright install chromium`;
 *  locally PLAYWRIGHT_BROWSERS_PATH can point at a preinstalled one). */
let browser;
export async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch();
  }
  return browser;
}
export async function closeBrowser() {
  await browser?.close();
  browser = undefined;
}

/** `entered: false` gives a first-time visitor, who sees the about page at "/" on a phone
 *  until tapping «ورود به فرفرو». By default the visitor has already entered, so "/" is the app. */
export async function newPage({ width = 390, cookie = "", entered = true } = {}) {
  const context = await (await getBrowser()).newContext({ viewport: { width, height: 820 }, locale: "fa-IR" });
  if (entered) {
    await context.addInitScript({ content: 'try { localStorage.setItem("frfro-entered", "1"); } catch (e) {}' });
  }
  if (cookie) {
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: TEST_BASE_URL }]);
  }
  // A returning phone visitor: "/" opens the app, not the about page (HOME_LANDING_SKIP_KEY).
  await context.addInitScript(() => {
    try { window.localStorage.setItem("frfro-entered", "1"); } catch {}
  });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return { page, context, problems };
}
