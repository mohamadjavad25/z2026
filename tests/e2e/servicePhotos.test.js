import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TEST_BASE_URL } from "../globalSetup.js";
import { newClient, newSalon, q } from "../integration/exitHelpers.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PHOTO = fileURLToPath(new URL("../../scripts/screens/samples/work-1.jpg", import.meta.url));
const PHOTO_DATA = `data:image/jpeg;base64,${readFileSync(PHOTO).toString("base64")}`;

/** Sample photos on services (2026-11-06), in a real phone-sized browser: the owner's picker and the client's menu. */
describe("sample photos on services (browser)", () => {
  it("the client sees the cover, opens it, picks the service from it; an icon-stays service shows only the small button", async () => {
    const salon = await newSalon("Photo Menu Salon");
    const services = (await salon.api.get("/api/salon-services")).payload.data.services;
    const [first, second] = services;
    const works = [];
    for (const title of ["یک", "دو"]) works.push((await salon.api.post("/api/posts", { title, tag: first.name, image: PNG })).payload.data.post.id);
    expect((await salon.api.put("/api/service-photos", { serviceId: first.id, postIds: works, photoAsCover: true })).ok).toBe(true);
    expect((await salon.api.put("/api/service-photos", { serviceId: second.id, postIds: [works[0]], photoAsCover: false })).ok).toBe(true);
    const client = await newClient("Photo Menu Client");

    const { page, context, problems } = await newPage({ cookie: client.api.cookie() });
    page.setDefaultTimeout(8000);
    await page.goto(`${TEST_BASE_URL}/?open=salon-${salon.id}`, { waitUntil: "networkidle" });
    if (!(await page.locator(".sduPanel").count())) await page.locator(".spvBarBook").first().click();
    await page.locator(".sduPanel").waitFor();

    // The first service shows its cover instead of the icon; the second keeps its icon and a small button.
    expect(await page.locator(".sduCoverBtn").count()).toBe(1);
    expect(await page.locator(".svcPhotoPill").count()).toBe(1);

    await page.locator(".sduCoverBtn").click();
    await page.locator(".spvSheet").waitFor();
    expect(await page.locator(".spvSlide").count()).toBe(2);
    await page.locator(".spvPick").click(); // «همین رو می‌خوام»
    await page.locator(".spvSheet").waitFor({ state: "detached" });
    expect(await page.locator(".sduItem.is-selected").count()).toBe(1);
    expect(await page.locator(".sduConfirm").innerText()).toContain("ادامه");

    // The small button opens the viewer too, and a tap outside (the × here) closes it without picking.
    await page.locator(".svcPhotoPill").click();
    await page.locator(".spvSheet").waitFor();
    await page.locator(".spvX").click();
    await page.locator(".spvSheet").waitFor({ state: "detached" });
    expect(await page.locator(".sduItem.is-selected").count()).toBe(1);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("a work that is a sample of a service shows the service in the post, and «همین رو می‌خوام» picks it in the menu", async () => {
    const salon = await newSalon("Post Service Salon");
    const service = (await salon.api.get("/api/salon-services")).payload.data.services[0];
    const work = (await salon.api.post("/api/posts", { title: "نمونه", tag: service.name, image: PHOTO_DATA })).payload.data.post.id;
    const plain = (await salon.api.post("/api/posts", { title: "ساده", tag: service.name, image: PHOTO_DATA })).payload.data.post.id;
    expect((await salon.api.put("/api/service-photos", { serviceId: service.id, postIds: [work], photoAsCover: true })).ok).toBe(true);
    const client = await newClient("Post Service Client");

    const { page, context, problems } = await newPage({ cookie: client.api.cookie() });
    page.setDefaultTimeout(8000);
    await page.goto(`${TEST_BASE_URL}/?open=salon-${salon.id}`, { waitUntil: "networkidle" });
    if (await page.locator(".sduPanel").count()) await page.locator(".sduDim").first().click({ position: { x: 10, y: 10 } });
    await page.locator(".sduPanel").waitFor({ state: "detached" });

    // The newest work has no service; the next one does.
    const tiles = page.locator(".salonClientMosaicTile");
    await tiles.first().click();
    await page.locator(".pvSheet").waitFor();
    const title = await page.locator(".pvTitleRow h3").innerText();
    if (title === "ساده") {
      expect(await page.locator(".pvService").count()).toBe(0);
      await page.locator(".pvNav").first().click();
    }
    await page.locator(".pvService").waitFor();
    expect(await page.locator(".pvService").innerText()).toContain(service.name);
    await page.locator(".pvServiceBook").click();
    await page.locator(".pvSheet").waitFor({ state: "detached" });
    await page.locator(".sduPanel").waitFor();
    expect(await page.locator(".sduItem.is-selected").count()).toBe(1);

    // While a photo is open the menu steps aside, and the whole post is one tap away.
    await page.locator(".sduCoverBtn").click();
    await page.locator(".spvSheet").waitFor();
    expect(await page.locator(".sduPanel").isVisible()).toBe(false);
    expect(await page.locator(".spvPost").getAttribute("href")).toBe(`/p/${work}`);
    await page.locator(".spvX").click();
    await page.locator(".spvSheet").waitFor({ state: "detached" });
    expect(await page.locator(".sduPanel").isVisible()).toBe(true);
    expect(plain).toBeGreaterThan(0);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("the owner puts a work and a gallery photo on a service from the picker, and a private work never shows to clients", async () => {
    const salon = await newSalon("Photo Owner Salon");
    const services = (await salon.api.get("/api/salon-services")).payload.data.services;
    const target = services[0];
    const work = (await salon.api.post("/api/posts", { title: "کار من", tag: target.name, image: PNG })).payload.data.post.id;
    const hidden = (await salon.api.post("/api/posts", { title: "خصوصی", tag: target.name, image: PNG, isPublic: false })).payload.data.post.id;

    const { page, context, problems } = await newPage({ cookie: salon.api.cookie() });
    page.setDefaultTimeout(8000);
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.locator(".profileModeRail button, [role=tab], button", { hasText: "خدمات" }).first().click();
    const card = page.locator(".svcCard", { hasText: target.name }).first();
    await card.locator(".svcPhotoBadge").click();
    await page.locator(".svcPhotosSheet").waitFor();
    // The portfolio work is offered, the private one is not; «از گالری» is the first tile.
    await page.locator(".svcPhotosTile:not(.is-add)").first().waitFor(); // the works arrive a moment after the sheet
    expect(await page.locator(".svcPhotosTile").count()).toBe(2); // gallery tile + the public work
    await page.locator(".svcPhotosTile:not(.is-add)").first().click();
    await page.locator(".svcPhotosSheet input[type=file]").setInputFiles(PHOTO);
    await page.locator(".svcPhotosTile.is-picked").nth(1).waitFor(); // the gallery photo uploaded and picked
    await page.locator(".svcPhotosSave").click();
    await page.locator(".svcPhotosSheet").waitFor({ state: "detached" });

    const saved = (await salon.api.get("/api/salon-services")).payload.data.services.find((service) => service.id === target.id);
    expect(saved.photos).toHaveLength(2);
    expect(saved.photos.map((photo) => photo.postId)).toContain(work);
    expect(saved.photos.map((photo) => photo.postId)).not.toContain(hidden);
    // The gallery photo is not in the portfolio.
    const portfolio = (await salon.api.get("/api/posts")).payload.data.posts.map((post) => post.id);
    expect(portfolio.sort()).toEqual([work, hidden].sort());
    expect(problems).toEqual([]);
    await context.close();

    // A work made private afterwards leaves the service for clients but not for the owner.
    expect((await salon.api.patch(`/api/posts/${work}`, { isPublic: false })).ok).toBe(true);
    const client = await newClient("Photo Owner Client");
    const seen = (await client.api.get(`/api/salons/${salon.id}`)).payload.data.salon.services.find((service) => service.id === target.id);
    expect(seen.photos.map((photo) => photo.postId)).not.toContain(work);
  });

  it("unused gallery photos are swept after two hours, never the ones a service uses", async () => {
    const salon = await newSalon("Photo Sweep Salon");
    const service = (await salon.api.get("/api/salon-services")).payload.data.services[0];
    const used = (await salon.api.post("/api/posts", { title: "در خدمت", image: PNG, inPortfolio: false })).payload.data.post.id;
    const idle = (await salon.api.post("/api/posts", { title: "بی‌صاحب", image: PNG, inPortfolio: false })).payload.data.post.id;
    const fresh = (await salon.api.post("/api/posts", { title: "تازه", image: PNG, inPortfolio: false })).payload.data.post.id;
    expect((await salon.api.put("/api/service-photos", { serviceId: service.id, postIds: [used] })).ok).toBe(true);
    await q("UPDATE posts SET created_at = created_at - INTERVAL '3 hours' WHERE id = ANY($1)", [[used, idle]]);
    // Saving the service sweeps (after the answer): poll until the idle one is gone.
    expect((await salon.api.patch("/api/salon-services", { id: service.id, name: service.name })).ok).toBe(true);
    for (let i = 0; i < 20 && (await q("SELECT 1 FROM posts WHERE id = $1", [idle])).length; i += 1) await new Promise((resolve) => setTimeout(resolve, 250));
    expect(await q("SELECT 1 FROM posts WHERE id = $1", [idle])).toHaveLength(0);
    expect(await q("SELECT 1 FROM posts WHERE id = $1", [used])).toHaveLength(1); // linked: kept
    expect(await q("SELECT 1 FROM posts WHERE id = $1", [fresh])).toHaveLength(1); // under two hours: kept
  });
});
