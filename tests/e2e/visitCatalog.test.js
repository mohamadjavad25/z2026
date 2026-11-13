/* global document */
import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { q } from "../integration/angle2Util.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

/** frfro.ir/v (owner, 2026-11-13): the catalog a field visitor shows a salon or an artist in person. */
describe("the field visitors' catalog (browser)", () => {
  it("opens on the two categories, pages through a deck, and the back key returns to the categories", async () => {
    const { page, context } = await newPage({ width: 390 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${TEST_BASE_URL}/v`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /سالن دارم/ }).click();
    await page.getByRole("heading", { name: "نوبت‌های سالن، بی‌دردسر" }).waitFor();
    await page.getByRole("button", { name: "بعدی" }).click();
    await expect.poll(() => page.locator(".vcat__count").textContent()).toContain("۲");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    // The free days and the price come from plans.js.
    await expect.poll(() => page.locator(".vcat__price li").count()).toBe(3);

    await page.goBack();
    await page.getByRole("button", { name: /آرتیستم/ }).waitFor();
    expect(errors).toEqual([]);

    // The opening is counted under the catalog's own tag.
    await expect.poll(async () => (await q("SELECT COALESCE(SUM(n), 0)::int AS n FROM landing_visits WHERE source = 'visit' AND kind = 'open'"))[0]?.n).toBeGreaterThan(0);
    await context.close();
  }, 40000);

  it("has a version without screen pictures at /v/clean", async () => {
    const { page, context } = await newPage({ width: 390 });
    await page.goto(`${TEST_BASE_URL}/v/clean`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /سالن دارم/ }).click();
    await page.getByRole("button", { name: "بعدی" }).click();
    await page.locator(".vmock").first().waitFor();
    expect(await page.locator("img[src*='/tutorial/']").count()).toBe(0);
    await context.close();
  }, 40000);
});
