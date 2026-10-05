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

export async function newPage({ width = 390, cookie = "" } = {}) {
  const context = await (await getBrowser()).newContext({ viewport: { width, height: 820 }, locale: "fa-IR" });
  if (cookie) {
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: TEST_BASE_URL }]);
  }
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return { page, context, problems };
}
