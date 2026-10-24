import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { newClient, teamSalon } from "../integration/exitHelpers.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const tabOf = (page, label) => page.locator(".profileModeRail button, [role=tab], button", { hasText: label }).first();

/** The screens of the owner's idea of 2026-10-24 (where an artist on a salon team receives clients), in a real phone-sized browser. */
describe("where an artist receives their clients (browser)", () => {
  it("the artist picks a place per day and saves; the client's booking sheet names the place of each day", async () => {
    const { salon, members } = await teamSalon("Place Browser Salon", 1);
    const artist = members[0];
    const client = await newClient("Place Browser Client");

    const artistView = await newPage({ cookie: artist.api.cookie() });
    const page = artistView.page;
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await tabOf(page, "همکاری").click();
    const box = page.locator(".plBox");
    await box.waitFor();
    expect(await box.innerText()).toContain("مشتری‌هات کجا نوبت بگیرن؟");
    // Nothing chosen yet: «جای خودم» is on, the save button waits for a change.
    expect(await box.getByRole("radio", { name: /^جای خودم/ }).getAttribute("aria-checked")).toBe("true");
    expect(await box.getByRole("button", { name: "ذخیره" }).isDisabled()).toBe(true);
    await box.getByRole("radio", { name: /^هر روز یه جا/ }).click();
    await box.getByRole("button", { name: /^شنبه، جای خودم/ }).click();
    await box.getByRole("button", { name: "ذخیره" }).click();
    await box.getByText("ذخیره شد. از الان مشتری‌هات همین‌طور نوبت می‌گیرن.").waitFor();
    const place = (await artist.api.get("/api/artist/place")).payload.data.place;
    expect(place).toMatchObject({ mode: "days", days: "soooooo", salonName: salon.user.name });
    expect(artistView.problems).toEqual([]);
    await artistView.context.close();

    const clientView = await newPage({ cookie: client.api.cookie() });
    const cp = clientView.page;
    await cp.goto(`${TEST_BASE_URL}/?open=artist-${artist.id}`, { waitUntil: "networkidle" });
    await cp.locator(".plTeamChip", { hasText: salon.user.name }).waitFor();
    const item = cp.locator("button.sduItem").first();
    await item.waitFor();
    await item.click();
    await cp.locator(".sduPanel button", { hasText: "رزرو" }).last().click({ force: true });
    const days = cp.locator(".bspDay");
    await days.first().waitFor();
    expect(await days.count()).toBe(7);
    const atSalon = cp.locator(".bspDay.is-at-salon");
    expect(await atSalon.count()).toBeGreaterThanOrEqual(1);
    expect(await atSalon.count()).toBeLessThanOrEqual(2); // 7 days hold at most two Saturdays
    await atSalon.first().click();
    const note = cp.locator(".plPlace.is-salon");
    await note.waitFor();
    expect(await note.innerText()).toContain(`توی ${salon.user.name} هست`);
    // A day at the artist's own place says so, and a closed day says why.
    await cp.locator(".bspDay.is-at-own").first().click();
    await cp.locator(".plPlace.is-own").waitFor();
    expect(clientView.problems).toEqual([]);
    await clientView.context.close();
  });

  it("the salon's switch in the member's sheet closes the salon days; the artist's screen says so", async () => {
    const { salon, members } = await teamSalon("Place Switch Salon", 1);
    const artist = members[0];
    expect((await artist.api.put("/api/artist/place", { mode: "salon" })).ok).toBe(true);

    const salonView = await newPage({ cookie: salon.api.cookie() });
    const sp = salonView.page;
    await sp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await tabOf(sp, "پرسنل").click();
    await sp.getByRole("button", { name: /^مدیریت / }).first().click();
    const toggle = sp.getByRole("switch", { name: "نوبت مستقیم توی سالن" });
    await toggle.waitFor();
    expect(await toggle.getAttribute("aria-checked")).toBe("true");
    await toggle.click();
    await sp.getByText("نوبت مستقیم توی سالن بسته شد.").first().waitFor();
    expect((await artist.api.get("/api/artist/place")).payload.data.place.allowed).toBe(false);
    expect(salonView.problems).toEqual([]);
    await salonView.context.close();

    const artistView = await newPage({ cookie: artist.api.cookie() });
    const ap = artistView.page;
    await ap.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await tabOf(ap, "همکاری").click();
    const box = ap.locator(".plBox");
    await box.waitFor();
    expect(await box.innerText()).toContain("نوبت مستقیم رو بسته؛ مشتری‌هات الان نمی‌تونن روزهای سالن رو بگیرن.");
    expect(await box.getByRole("radio", { name: /^توی / }).isDisabled()).toBe(true);
    expect(artistView.problems).toEqual([]);
    await artistView.context.close();
  });
});
