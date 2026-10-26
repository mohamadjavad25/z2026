import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { newClient, teamSalon } from "../integration/exitHelpers.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** The salon page's team cards (owner's decision 2026-10-26), in a real phone-sized browser. */
describe("the team on a salon's page (browser)", () => {
  it("shows a card per artist with their posts, opens their sheet, and books with them", async () => {
    const { salon, members } = await teamSalon("Team Card Salon", 2);
    const [negar, sahar] = members;
    // Both do «کوتاهی مو»; only Negar has a post.
    const services = (await salon.api.get("/api/salon-services")).payload.data.services;
    const cut = services.find((service) => service.name === "کوتاهی مو");
    expect((await salon.api.patch("/api/salon-services", { id: cut.id, name: cut.name, staff_ids: [String(negar.staff.id), String(sahar.staff.id)] })).ok).toBe(true);
    expect((await negar.api.post("/api/posts", { title: "کار نگار", tag: "مو", image: PNG })).ok).toBe(true);
    const client = await newClient("Team Card Client");
    expect((await client.api.post("/api/connections", { targetUserId: salon.id })).ok).toBe(true);

    const { page, context, problems } = await newPage({ cookie: client.api.cookie() });
    page.setDefaultTimeout(8000);
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const home = page.locator(".clientHome .cnPage.is-compact");
    await home.getByPlaceholder("اسم سالن یا آرتیست").fill(salon.user.name);
    await home.locator(".cnCard").filter({ hasText: salon.user.name }).filter({ hasNotText: "Artist" }).first().click();

    const negarCard = page.locator(".stmCard", { hasText: negar.user.name });
    await negarCard.waitFor();
    expect(await page.locator(".stmCard").count()).toBe(2);
    expect(await negarCard.locator(".stmThumbs img").count()).toBe(1);
    expect(await negarCard.innerText()).toContain("کوتاهی مو");
    expect(await page.locator(".stmCard", { hasText: sahar.user.name }).innerText()).toContain("هنوز نمونه‌کاری نذاشته");
    // Negar's post is in the salon's gallery too, with her name on it.
    expect(await page.locator(".salonPublicPortfolio .salonClientMosaicBy").first().innerText()).toBe(negar.user.name);

    await negarCard.click();
    const sheet = page.locator(".stmSheet");
    await sheet.waitFor();
    expect(await sheet.innerText()).toContain("کوتاهی مو");
    expect(await sheet.innerText()).toContain(`صفحهٔ ${negar.user.name}`);
    await sheet.getByRole("button", { name: `رزرو با ${negar.user.name}` }).click();

    const menu = page.locator(".sduPanel");
    await menu.waitFor();
    expect(await menu.innerText()).toContain(`کارهای ${negar.user.name}؛ نوبتت با خودش ثبت می‌شه.`);
    await menu.locator(".sduItem").first().click();
    await menu.locator(".sduConfirm").click();

    await page.getByRole("heading", { name: `نوبت با ${negar.user.name} در ${salon.user.name}` }).waitFor();
    expect(await page.locator(".vbPeople").count()).toBe(0);
    await page.locator(".vbTime.is-on").waitFor();
    await page.getByRole("button", { name: /^بفرست/ }).waitFor();
    await page.locator(".vbSubmit").click();
    await page.locator(".vbTime").first().waitFor({ state: "detached" });

    const bookings = (await salon.api.get("/api/salon-bookings")).payload.data.bookings;
    const mine = bookings.find((booking) => booking.client === client.user.name);
    expect(mine.staff).toBe(negar.staff.name);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("the artist turns their posts off for that salon from its card in «همکاری»", async () => {
    const { salon, members } = await teamSalon("Team Posts Switch", 1);
    const artist = members[0];
    const { page, context, problems } = await newPage({ cookie: artist.api.cookie() });
    page.setDefaultTimeout(8000);
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.locator(".profileModeRail button, [role=tab], button", { hasText: "همکاری" }).first().click();
    const toggle = page.getByRole("switch", { name: `پست‌هات توی صفحهٔ ${salon.user.name} هم بیاد` });
    await toggle.waitFor();
    expect(await toggle.getAttribute("aria-checked")).toBe("true");
    await toggle.click();
    await page.getByText("خاموشه؛ پست‌هات فقط توی صفحهٔ خودت هستن.").waitFor();
    expect(await toggle.getAttribute("aria-checked")).toBe("false");
    const teams = (await artist.api.get("/api/artist/teams")).payload.data.teams;
    expect(teams.find((team) => team.salonId === salon.id).postsOnSalon).toBe(false);
    expect(problems).toEqual([]);
    await context.close();
  });
});
