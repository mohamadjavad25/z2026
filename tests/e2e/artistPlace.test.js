import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { FAR_DAY, newClient, teamSalon } from "../integration/exitHelpers.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const tabOf = (page, label) => page.locator(".profileModeRail button, [role=tab], button", { hasText: label }).first();

/** The owner's decision of 2026-10-25: one workplace at a time, set from the salon's wallet card, in a real phone-sized browser. */
describe("where an artist's clients are received (browser)", () => {
  it("the artist turns on «مشتری‌های خودت میان اینجا» on the salon's card, and the client's booking sheet says where", async () => {
    const { salon, members } = await teamSalon("Place Browser Salon", 1);
    const artist = members[0];
    const client = await newClient("Place Browser Client");

    const artistView = await newPage({ cookie: artist.api.cookie() });
    const page = artistView.page;
    page.setDefaultTimeout(8000);
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await tabOf(page, "همکاری").click();
    const card = page.locator(".clwCard", { hasText: salon.user.name });
    await card.waitFor();
    expect(await card.innerText()).toContain("توی تیمشی");
    await page.locator(".clwNow", { hasText: "جای خودت" }).waitFor();
    expect(await page.locator(".clwDots").count()).toBe(0);
    const toggle = page.getByRole("switch", { name: `مشتری‌های خودت میان ${salon.user.name}` });
    expect(await toggle.getAttribute("aria-checked")).toBe("false");
    // No booking ahead: one question («از کی؟»), then it is done.
    await toggle.click();
    await page.getByText(`مشتری‌هات از کی بیان ${salon.user.name}؟`).waitFor();
    expect(await page.getByRole("radio", { name: "از همین الان" }).getAttribute("aria-checked")).toBe("true");
    await page.getByRole("button", { name: "ادامه" }).click();
    await page.getByText(`از امروز مشتری‌هات میان ${salon.user.name}.`).waitFor();
    expect(await card.innerText()).toContain("الان اینجا کار می‌کنی");
    expect(await toggle.getAttribute("aria-checked")).toBe("true");
    expect((await artist.api.get("/api/artist/place")).payload.data.workplace.current).toBe(salon.id);

    // Back to the artist's own place with one booking ahead: step two lists it and asks.
    const made = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "کوتاهی مو", bookingDate: FAR_DAY(3), time: "11:00" });
    expect(made.ok).toBe(true);
    await toggle.click();
    await page.getByText("مشتری‌هات از کی بیان جای خودت؟").waitFor();
    await page.getByRole("button", { name: "ادامه" }).click();
    await page.getByText("این نوبت هم بیاد جای خودت؟").waitFor();
    await page.getByText("این نوبتیه که از الان به بعد داری.").waitFor();
    expect(await page.locator(".clwBk").innerText()).toContain("کوتاهی مو");
    await page.getByRole("button", { name: "آره، بیاد جای خودت" }).click();
    await page.getByText("از امروز مشتری‌هات میان جای خودت. ۱ نوبت جابه‌جا شد و به مشتری‌هاش خبر دادیم.").waitFor();
    expect(await toggle.getAttribute("aria-checked")).toBe("false");

    // And to the salon again, from tomorrow, keeping that booking where it is.
    await toggle.click();
    await page.getByRole("radio", { name: "از فردا" }).click();
    await page.getByRole("button", { name: "ادامه" }).click();
    await page.getByText(`این نوبت هم بیاد ${salon.user.name}؟`).waitFor();
    await page.getByText("این نوبتیه که از فردا به بعد داری.").waitFor();
    await page.getByRole("button", { name: "نه، همین‌جا بمونه" }).click();
    await page.getByText(`از فردا مشتری‌هات میان ${salon.user.name}.`).waitFor();
    const rows = (await artist.api.get("/api/artist/me")).payload.data.bookings;
    expect(rows.find((row) => row.id === made.payload.data.booking.id).placeSalon).toBeNull();
    await page.getByRole("button", { name: "لغو" }).click();
    await page.getByText("جابه‌جایی لغو شد.").waitFor();
    await toggle.click();
    await page.getByRole("button", { name: "ادامه" }).click();
    await page.getByRole("button", { name: `آره، بیاد ${salon.user.name}` }).click();
    await page.getByText(`از امروز مشتری‌هات میان ${salon.user.name}. ۱ نوبت جابه‌جا شد و به مشتری‌هاش خبر دادیم.`).waitFor();
    expect((await artist.api.get("/api/artist/place")).payload.data.workplace.current).toBe(salon.id);
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
    expect(await cp.locator(".plWhere").innerText()).toContain(salon.user.name);
    expect(clientView.problems).toEqual([]);
    await clientView.context.close();
  });

  it("accepting a salon's invite asks once whether the artist's own clients come there too", async () => {
    const { salon, members } = await teamSalon("Place Invite Home", 1);
    const artist = members[0];
    const { salon: inviter } = await teamSalon("Place Invite New", 0);
    expect((await inviter.api.post("/api/salon-invites", { artistUserId: artist.id })).status).toBe(201);

    const view = await newPage({ cookie: artist.api.cookie() });
    const page = view.page;
    page.setDefaultTimeout(8000);
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await tabOf(page, "همکاری").click();
    // The invite shows even while the artist is on a team: it is the first card, with the dots for the two.
    const invite = page.locator(".clwCard.is-active", { hasText: inviter.user.name });
    await invite.waitFor();
    expect(await invite.innerText()).toContain("دعوت تازه");
    expect(await page.locator(".clwDots button").count()).toBe(2);
    await page.locator(".clwPanel").getByRole("button", { name: "قبول" }).click();
    await page.getByText(`مشتری‌هایی که خودشون ازت نوبت می‌گیرن هم بیان ${inviter.user.name}؟`).waitFor();
    await page.getByRole("button", { name: "آره، بیان اینجا" }).click();
    await page.getByText(`از امروز مشتری‌هات میان ${inviter.user.name}.`).waitFor();
    expect((await artist.api.get("/api/artist/place")).payload.data.workplace.current).toBe(inviter.id);
    expect(await page.locator(".clwCard").count()).toBe(2);
    expect(await page.locator(".clwCard", { hasText: salon.user.name }).innerText()).toContain("توی تیمشی");
    expect(view.problems).toEqual([]);
    await view.context.close();
  });

  it("the salon's switch in the member's sheet is off: the artist's card says so and the switch is locked", async () => {
    const { salon, members } = await teamSalon("Place Switch Salon", 1);
    const artist = members[0];

    const salonView = await newPage({ cookie: salon.api.cookie() });
    const sp = salonView.page;
    await sp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await tabOf(sp, "پرسنل").click();
    // The team tab's member card (a button named after the member) opens the member's sheet.
    await sp.locator(".twCard").first().click();
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
    await ap.getByText(`${salon.user.name} فعلاً مشتری‌های خودت رو قبول نمی‌کنه؛ میان جای خودت.`).waitFor();
    expect(await ap.getByRole("switch", { name: `مشتری‌های خودت میان ${salon.user.name}` }).isDisabled()).toBe(true);
    expect(artistView.problems).toEqual([]);
    await artistView.context.close();
  });

  it("the ✕ beside a saved spot asks first: «نه، بمونه» keeps it, «آره، پاک کن» removes it", async () => {
    const { members } = await teamSalon("Place Spot Salon", 1);
    const artist = members[0];
    expect((await artist.api.post("/api/profile", { data: { area: "تهران، خیابان لاله", addressDetail: "واحد ۳", geo: { lat: 35.7, lng: 51.4 } } })).ok).toBe(true);
    const view = await newPage({ cookie: artist.api.cookie() });
    const page = view.page;
    page.setDefaultTimeout(8000);
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.locator("nav.bottomNav > button").nth(0).click();
    await page.locator(".profileLocationRow").first().waitFor();
    await page.locator(".profileLocationRowClear").click();
    await page.getByText("جات از روی نقشه پاک بشه؟").waitFor();
    await page.getByRole("button", { name: "نه، بمونه" }).click();
    expect(await page.locator(".profileLocationRow").first().innerText()).toContain("تهران، خیابان لاله");
    expect((await artist.api.get("/api/auth/me")).payload.data.user.location.lat).toBe(35.7);
    await page.locator(".profileLocationRowClear").click();
    await page.getByRole("button", { name: "آره، پاک کن" }).click();
    await page.getByText("جات از روی نقشه پاک شد.").first().waitFor();
    expect((await artist.api.get("/api/auth/me")).payload.data.user.location).toBeNull();
    expect(view.problems).toEqual([]);
    await view.context.close();
  });
});
