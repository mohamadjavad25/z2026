import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { newClient, teamSalon } from "../integration/exitHelpers.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const tabOf = (page, label) => page.locator(".profileModeRail button, [role=tab], button", { hasText: label }).first();

/** The owner's idea of 2026-10-24 (second version): the artist's ordered list of salons, in a real phone-sized browser. */
describe("where an artist's clients are received (browser)", () => {
  it("the artist adds a salon to the list, saves, and the client's booking sheet shows no place at all", async () => {
    const { salon, members } = await teamSalon("Place Browser Salon", 1);
    const artist = members[0];
    const client = await newClient("Place Browser Client");

    const artistView = await newPage({ cookie: artist.api.cookie() });
    const page = artistView.page;
    page.setDefaultTimeout(8000);
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await tabOf(page, "همکاری").click();
    const box = page.locator(".plBox");
    await box.waitFor();
    expect(await box.innerText()).toContain("نوبت مشتری‌هام کجا باشه؟");
    expect(await box.innerText()).toContain("هنوز سالنی اضافه نکردی. همه نوبت‌ها مثل قبل می‌مونن.");
    expect(await box.getByRole("button", { name: "ذخیره" }).isDisabled()).toBe(true);
    await box.locator(".plAdd", { hasText: salon.user.name }).click();
    expect(await box.locator(".plRow").count()).toBe(1);
    await box.getByRole("radio", { name: "بهم خبر بده" }).click();
    await box.getByRole("button", { name: "ذخیره" }).click();
    await box.getByText("ذخیره شد. از الان نوبت‌ها همین‌طور جا می‌گیرن.").waitFor();
    const place = (await artist.api.get("/api/artist/place")).payload.data.place;
    expect(place.fallback).toBe("ask");
    expect(place.teams[0]).toMatchObject({ inList: true, name: salon.user.name });
    expect(artistView.problems).toEqual([]);
    await artistView.context.close();

    const clientView = await newPage({ cookie: client.api.cookie() });
    const cp = clientView.page;
    cp.setDefaultTimeout(8000);
    await cp.goto(`${TEST_BASE_URL}/?open=artist-${artist.id}`, { waitUntil: "networkidle" });
    const item = cp.locator("button.sduItem").first();
    await item.waitFor();
    await item.click();
    await cp.locator(".sduPanel button", { hasText: "رزرو" }).last().click({ force: true });
    await cp.locator(".bspDay").first().waitFor();
    expect(await cp.locator(".plPlace, .plTeamChip").count()).toBe(0);
    expect(await cp.locator(".artistPublicBookingPanel").innerText()).not.toContain(salon.user.name);
    expect(clientView.problems).toEqual([]);
    await clientView.context.close();
  });

  it("the salon's switch in the member's sheet is off: the artist's list says the salon is skipped", async () => {
    const { salon, members } = await teamSalon("Place Switch Salon", 1);
    const artist = members[0];
    expect((await artist.api.put("/api/artist/place", { order: [salon.user.id], fallback: "own" })).ok).toBe(true);

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
    expect(salonView.problems).toEqual([]);
    await salonView.context.close();

    const artistView = await newPage({ cookie: artist.api.cookie() });
    const ap = artistView.page;
    await ap.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await tabOf(ap, "همکاری").click();
    const box = ap.locator(".plBox");
    await box.waitFor();
    expect(await box.innerText()).toContain(`${salon.user.name} نوبت مستقیم رو بسته. نوبتی اونجا نمی‌افته.`);
    expect(artistView.problems).toEqual([]);
    await artistView.context.close();
  });
});
