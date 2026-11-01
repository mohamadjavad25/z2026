import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { newArtist, newSalon } from "../integration/exitHelpers.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

/** An old build of the frfro Android app around the site (build 1), while the admin panel says build 99 is out. */
const OLD_APP = `window.Capacitor = {
  isNativePlatform: () => true,
  getPlatform: () => "android",
  Plugins: {},
  PluginHeaders: [{ name: "App", methods: [{ name: "getInfo" }] }],
  nativePromise: (plugin, method) => plugin === "App" && method === "getInfo"
    ? Promise.resolve({ id: "ir.frfro.app", build: "1" })
    : Promise.reject(new Error("not in this test"))
};`;

async function openHome(person, oldApp) {
  const opened = await newPage({ cookie: person.api.cookie() });
  if (oldApp) {
    await opened.context.addInitScript({ content: OLD_APP });
    await opened.context.route(`${TEST_BASE_URL}/api/notice`, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data = { ...(body.data || {}), app: { latestBuild: 99, forceUpdate: false } };
      await route.fulfill({ response, json: body });
    });
  }
  await opened.context.route((url) => !url.href.startsWith(TEST_BASE_URL) && !url.href.startsWith("data:"), (route) => route.abort());
  opened.page.setDefaultTimeout(12000);
  await opened.page.goto(TEST_BASE_URL, { waitUntil: "load" });
  await opened.page.locator('.profileHero button[aria-label="اعلان‌ها"]').waitFor();
  return opened;
}

const box = (page, selector) => page.locator(selector).first().boundingBox();

/** Where the bell and support sit on the cover. */
async function corners(page) {
  return {
    bell: await box(page, '.profileHero button[aria-label="اعلان‌ها"]'),
    support: await box(page, ".profileHero .supportTopBtn")
  };
}

/** Owner's report 2026-11-02: the «به‌روزرسانی» pill beside the bell pushed the bell and support into the middle.
 *  The bell and support keep their corner; the pill sits alone in the middle of the top row. */
describe("the «به‌روزرسانی» pill on the profile cover (browser)", () => {
  for (const [who, make] of [["salon", () => newSalon("Pill Salon")], ["artist", () => newArtist("Pill Artist")]]) {
    it(`${who}: the bell and support stay put, the pill is centred and touches nothing`, async () => {
      const person = await make();
      const plain = await openHome(person, false);
      expect(await plain.page.locator(".appUpdPill").count()).toBe(0);
      const before = await corners(plain.page);
      await plain.context.close();

      const old = await openHome(person, true);
      const pill = old.page.locator(".appUpdPill");
      await pill.waitFor();
      await old.page.waitForTimeout(400);
      const after = await corners(old.page);
      for (const key of ["bell", "support"]) {
        expect(Math.abs(after[key].x - before[key].x)).toBeLessThan(2);
        expect(Math.abs(after[key].y - before[key].y)).toBeLessThan(2);
      }
      const p = await pill.boundingBox();
      const width = old.page.viewportSize().width;
      expect(p.width).toBeGreaterThan(80);
      expect(Math.abs(p.x + p.width / 2 - width / 2)).toBeLessThan(3);
      const qr = await box(old.page, '.profileHero [aria-label="کد QR و اسکن"]');
      for (const other of [after.bell, after.support, qr].filter(Boolean)) {
        const apart = p.x + p.width <= other.x || other.x + other.width <= p.x;
        expect(apart).toBe(true);
      }
      // Same height as the round buttons beside it.
      expect(Math.abs((p.y + p.height / 2) - (after.bell.y + after.bell.height / 2))).toBeLessThan(6);
      await old.context.close();
    }, 60000);
  }
});
