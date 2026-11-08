#!/usr/bin/env node
/**
 * Raw phone pictures for the store listing (Cafe Bazaar, Myket), day and night (scripts/store/README.md).
 * Needs the app running on an empty throwaway database; seed.mjs makes the sample world on first run.
 *
 *   STORE_BASE_URL=http://localhost:3300 STORE_OUT=<folder> node scripts/store/shots.mjs [ids…]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { BASE, people } from "./seed.mjs";

const OUT = process.env.STORE_OUT || path.resolve("store-shots");
const wait = (ms) => async (p) => { await p.waitForTimeout(ms); };
const tab = (i) => async (p) => { await p.locator("nav.bottomNav > button").nth(i).click({ timeout: 6000, force: true }); await p.waitForTimeout(1500); };
const tap = (name) => async (p) => { await p.getByRole("button", { name }).first().click({ timeout: 6000, force: true }); await p.waitForTimeout(1200); };
const css = (selector, hasText) => async (p) => { await p.locator(selector, hasText ? { hasText } : {}).first().click({ timeout: 6000 }); await p.waitForTimeout(1200); };
const pickRose = async (p) => { await p.getByRole("tab", { name: /رز سپید/ }).first().click({ timeout: 6000, force: true }); await p.waitForTimeout(1500); };
const openBooker = async (p) => {
  await p.locator("button", { hasText: "کوتاهی مو" }).filter({ hasText: "رزرو" }).first().click({ timeout: 6000 });
  await p.waitForTimeout(1500);
  await p.locator(".sduConfirm").click();
  await p.waitForTimeout(1800);
};

export const SHOTS = [
  { id: "salon", role: "client", path: (ids) => `/?open=salon-${ids.rose}`, steps: [wait(1500), css(".spvBarBook.is-open")] },
  { id: "time", role: "client", steps: [tab(2), pickRose, openBooker, async (p) => { await p.locator("button.vbDayCard", { hasText: "فردا" }).first().click({ timeout: 6000 }); await p.waitForTimeout(1800); }] },
  { id: "my-salons", role: "client", steps: [tab(2), pickRose] },
  { id: "my-bookings", role: "client", steps: [wait(1000)] },
  { id: "where", role: "client", map: true, steps: [tap(/^رز سپید، کوتاهی مو/), async (p) => { await p.locator(".locCard.is-pinned").first().click({ timeout: 6000 }); await p.waitForTimeout(4000); }] },
  { id: "salon-home", role: "rose", steps: [tap("روز بعد"), async (p) => { await p.evaluate(() => globalThis.scrollTo(0, 150)); await p.waitForTimeout(800); }] }
];

async function closeArrivalDialogs(page) {
  const skip = page.locator(".onbRoot .onbSkip");
  if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(700); }
  for (let k = 0; k < 3; k += 1) {
    const close = page.locator(".sbmScreen button", { hasText: "بستن" });
    if (!(await close.count())) break;
    await close.first().click().catch(() => {});
    await page.waitForTimeout(700);
  }
}

async function main() {
  const only = new Set(process.argv.slice(2));
  const { sessions, ids } = await people();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const shot of SHOTS) {
    if (only.size && !only.has(shot.id)) continue;
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width: 360, height: 760 }, deviceScaleFactor: 3, locale: "fa-IR", isMobile: true, hasTouch: true, colorScheme: scheme });
      await context.addInitScript({ content: `try { localStorage.setItem("frfro-entered", "1"); const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith("frfro-tip") || k === "frfro-due-later" ? "1" : g.call(this, k); }; } catch (e) {}` });
      const [name, ...rest] = sessions[shot.role].cookie().split("=");
      await context.addCookies([{ name, value: rest.join("="), url: BASE }]);
      // Only the map may reach outside (its tiles); everything else stays local.
      if (!shot.map) await context.route((url) => !url.href.startsWith(BASE) && !url.href.startsWith("data:"), (route) => route.abort());
      const page = await context.newPage();
      const problems = [];
      page.on("pageerror", (error) => problems.push(error.message));
      await page.goto(BASE + (shot.path ? shot.path(ids) : "/"), { waitUntil: "load" });
      await page.waitForTimeout(3500);
      // The dev server's «Issues» badge (next dev) is not part of the app.
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await closeArrivalDialogs(page);
      for (const step of shot.steps) {
        try { await step(page); } catch (error) { problems.push(`step: ${error.message.split("\n")[0]}`); }
      }
      await page.addStyleTag({ content: ".notice-glass { display: none !important; }" });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, `${shot.id}-${scheme}.png`) });
      console.log(`${shot.id}-${scheme}${problems.length ? `  (${problems[0].slice(0, 100)})` : ""}`);
      await context.close();
    }
  }
  await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
