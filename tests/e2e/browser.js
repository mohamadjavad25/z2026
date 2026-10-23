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
 *  until tapping «ورود به فرفرو». By default the visitor has already entered, so "/" is the app.
 *  `tipSeen: false` keeps the one-time spotlight on a salon/artist's «+» (CreateBookingTip), which
 *  otherwise covers the screen; by default it counts as already seen. */
export async function newPage({ width = 390, cookie = "", entered = true, tipSeen = true } = {}) {
  const context = await (await getBrowser()).newContext({ viewport: { width, height: 820 }, locale: "fa-IR" });
  if (entered) {
    await context.addInitScript({ content: 'try { localStorage.setItem("frfro-entered", "1"); } catch (e) {}' });
  }
  if (tipSeen) {
    // The tip is remembered per account ("frfro-tip-create-booking:<id>"), so every such key reads as seen.
    await context.addInitScript({ content: 'try { const get = Storage.prototype.getItem; Storage.prototype.getItem = function (key) { return String(key).startsWith("frfro-tip-create-booking") ? "1" : get.call(this, key); }; } catch (e) {}' });
  }
  if (cookie) {
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: TEST_BASE_URL }]);
  }
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return { page, context, problems };
}
