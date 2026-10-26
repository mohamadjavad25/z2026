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
    const made = await negar.api.post("/api/posts", { title: "کار نگار", tag: "مو", image: PNG });
    expect(made.ok).toBe(true);
    // It shows on the salon's page only once the salon added it (owner's decision 2026-10-26).
    expect((await negar.api.post("/api/artist/team-posts", { postId: made.payload.data.post.id, salonUserId: salon.id, action: "send" })).ok).toBe(true);
    expect((await salon.api.post("/api/salon-team-posts", { postId: made.payload.data.post.id, action: "approve" })).ok).toBe(true);
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

  it("the artist sends a new post to the salon, and the salon adds it from «درخواست‌های تیم»", async () => {
    const { salon, members } = await teamSalon("Team Posts Ask", 1);
    const artist = members[0];
    const photo = Buffer.from(PNG.split(",")[1], "base64");

    const mine = await newPage({ cookie: artist.api.cookie() });
    mine.page.setDefaultTimeout(8000);
    await mine.page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await mine.page.locator(".profileModeRail button", { hasText: "نمونه‌کار" }).click();
    const [chooser] = await Promise.all([
      mine.page.waitForEvent("filechooser"),
      mine.page.getByRole("button", { name: /نمونه‌کار تازه/ }).first().click()
    ]);
    await chooser.setFiles({ name: "post.png", mimeType: "image/png", buffer: photo });
    const sheet = mine.page.locator("[role=dialog]").last();
    await sheet.getByRole("button", { name: /همین خوبه/ }).click();
    await sheet.locator(".artistWorkForm").waitFor();
    await sheet.getByPlaceholder("عنوان نمونه‌کار").fill("کار برای سالن");
    const send = sheet.getByRole("button", { name: new RegExp(`برای صفحهٔ ${salon.user.name} هم بفرست`) });
    expect(await send.getAttribute("aria-pressed")).toBe("false");
    await send.click();
    expect(await send.innerText()).toContain(`بعد از ذخیره می‌ره پیش ${salon.user.name} تا قبولش کنه.`);
    await sheet.locator(".artistWorkSave").click();
    await mine.page.getByText("ذخیره شد و رفت پیش سالن تا قبولش کنه.").waitFor();
    expect(mine.problems).toEqual([]);
    await mine.context.close();

    const theirs = await newPage({ cookie: salon.api.cookie() });
    theirs.page.setDefaultTimeout(8000);
    await theirs.page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await theirs.page.locator(".profileModeRail button", { hasText: "نمونه‌کار" }).click();
    const panel = theirs.page.locator(".teamPosts");
    await panel.getByText("درخواست‌های تیم").waitFor();
    expect(await panel.innerText()).toContain(artist.user.name);
    await panel.getByRole("button", { name: /اضافه کن/ }).click();
    await theirs.page.getByText("اضافه شد؛ توی صفحه‌ت با اسم آرتیست دیده می‌شه.").waitFor();
    await panel.getByText("پست‌های تیم توی صفحه‌ت").waitFor();
    expect(theirs.problems).toEqual([]);
    await theirs.context.close();

    const page = (await salon.api.get(`/api/salons/${salon.id}`)).payload.data.salon;
    expect(page.team.find((member) => member.artistId === artist.id).posts.map((item) => item.title)).toEqual(["کار برای سالن"]);
  });

  it("«رزرو با …» on the salon's website page opens the app's form with that artist", async () => {
    const { salon, members } = await teamSalon("Team Web Salon", 2);
    const [, sahar] = members;
    const client = await newClient("Team Web Client");
    const { page, context, problems } = await newPage({ cookie: client.api.cookie() });
    page.setDefaultTimeout(8000);
    await page.goto(`${TEST_BASE_URL}/salons/${salon.id}`, { waitUntil: "networkidle" });
    await page.locator(".stmCard", { hasText: sahar.user.name }).click();
    await page.locator(".stmSheet").getByRole("button", { name: `رزرو با ${sahar.user.name}` }).click();
    const menu = page.locator(".sduPanel");
    await menu.waitFor();
    await menu.locator(".sduItem").first().click();
    await menu.locator(".sduConfirm").click();
    // The app opens on the salon with the form already asking for Sahar.
    await page.getByRole("heading", { name: `نوبت با ${sahar.user.name} در ${salon.user.name}` }).waitFor({ timeout: 15000 });
    expect(problems).toEqual([]);
    await context.close();
  });

  it("arriving from a link, closing the services menu keeps the client on the salon's page", async () => {
    const { salon } = await teamSalon("Team Link Salon", 1);
    const client = await newClient("Team Link Client");
    const { page, context, problems } = await newPage({ cookie: client.api.cookie() });
    page.setDefaultTimeout(8000);
    await page.goto(`${TEST_BASE_URL}/?open=salon-${salon.id}`, { waitUntil: "networkidle" });
    await page.locator(".sduPanel").waitFor();
    await page.locator(".spvBarBook").click();
    await page.locator(".sduPanel").waitFor({ state: "detached" });
    await page.waitForTimeout(800);
    expect(await page.locator(".salonPublicProfile").count()).toBe(1);
    await page.locator(".stmCard").first().waitFor();
    expect(problems).toEqual([]);
    await context.close();
  });
});
