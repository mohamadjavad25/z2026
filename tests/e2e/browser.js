import { chromium } from "playwright";
import { TEST_BASE_URL } from "../globalSetup.js";

/** One shared headless Chromium for the e2e files (CI installs it with `npx playwright install chromium`;
 *  locally PLAYWRIGHT_BROWSERS_PATH can point at a preinstalled one). */
let browser;
export async function getBrowser() {
  if (!browser) {
    // PW_CHROMIUM: a Chromium binary when Playwright's own is not the installed one (the cloud container).
    browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  }
  return browser;
}
export async function closeBrowser() {
  await browser?.close();
  browser = undefined;
}

/** `entered: false` gives a first-time visitor, who sees the about page at "/" on a phone
 *  until tapping «ورود به فرفرو». By default the visitor has already entered, so "/" is the app.
 *  `dueLater: false` keeps the
 *  «وقتش شده» pop-up a salon/artist gets over their home until they confirm (DueRemindersCard); by
 *  default it reads as «فعلاً نه» for the session. */
export async function newPage({ width = 390, cookie = "", entered = true, dueLater = true } = {}) {
  const context = await (await getBrowser()).newContext({ viewport: { width, height: 820 }, locale: "fa-IR" });
  // Only the app under test: an outside host (the eNamad badge on the about page, map tiles, fonts) can hang from a CI
  // runner abroad, and «networkidle» then waits until every test times out (CI red from 2026-10-30, lesson 2026-11-04).
  await context.route((url) => !["localhost", "127.0.0.1"].includes(url.hostname), (route) => route.abort());
  if (entered) {
    await context.addInitScript({ content: 'try { localStorage.setItem("frfro-entered", "1"); } catch (e) {}' });
  }
  if (dueLater) {
    await context.addInitScript({ content: 'try { sessionStorage.setItem("frfro-due-later", "1"); } catch (e) {}' });
  }
  if (cookie) {
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: TEST_BASE_URL }]);
  }
  const page = await context.newPage();
  // The welcome and a new account's tutorial (features/onboarding) come up over the screen being tested: close them
  // the way a user would, with «رد شدن» («شروع کن» on a last slide), whenever they show.
  await page.addLocatorHandler(page.locator(".onbRoot"), async () => {
    const skip = page.locator(".onbSkip");
    await ((await skip.count()) ? skip : page.locator(".onbNext")).click();
  });
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return { page, context, problems };
}

/**
 * The client's step form (ClientVisitWizard), from its day step: «زودترین وقت خالی» → the ticket, with who does what
 * and a «درخواست نوبت» button that is ready.
 */
export async function clientToTicket(page) {
  await page.locator(".vbSoonest").click();
  await page.locator(".vbTicket .vbPlanRow").first().waitFor();
  await page.getByRole("button", { name: /^درخواست نوبت/ }).waitFor();
}
