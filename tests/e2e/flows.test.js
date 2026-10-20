/* global document, axe */
import { afterAll, describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, futureBookingDay, registerUser } from "../integration/helpers.js";
import { closeBrowser, newPage } from "./browser.js";

const persian = /[؀-ۿ]/;
afterAll(closeBrowser);

async function seedSalon() {
  const name = `سالن تست ${Math.floor(Math.random() * 1e6)}`;
  const client = createClient();
  const salon = await registerUser(client, { type: "salon", name });
  await client.get("/api/salon-hours");
  await client.post("/api/salon-services", { name: "کوتاهی مو", price: "300000", duration: "45 دقیقه" });
  return { name, client, salon };
}

// A client's «رزرو» tab opens on «سالن و آرتیست من»; the connect/search page is the «پیدا کردن» tab.
async function openExploreTab(page) {
  await page.locator("nav.bottomNav > button").nth(2).click();
  await page.getByRole("tab", { name: "پیدا کردن" }).click();
}

describe("about page first on phones (browser)", () => {
  it("shows the about page at / to a first-time phone visitor, and «ورود» opens the app for good", async () => {
    const { page, context, problems } = await newPage({ entered: false });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    expect(await page.locator(".landingSlot .appLanding").isVisible()).toBe(true);
    expect(await page.locator(".landingSlot a[href='/download/frfro.apk']").count()).toBeGreaterThan(0);
    await page.locator(".landingSlot .appLanding__hero .appLanding__enter").click();
    await page.locator(".landingSlot .appLanding").waitFor({ state: "hidden" });
    expect(await page.locator(".pageSlot").isVisible()).toBe(true);
    await page.reload({ waitUntil: "networkidle" });
    expect(await page.locator(".landingSlot .appLanding").isVisible()).toBe(false);
    expect(problems).toEqual([]);
    await context.close();
  });
});

describe("auth forms (browser)", () => {
  it("shows Persian inline errors instead of the browser's own messages", async () => {
    const { page, context, problems } = await newPage();
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.getByText("سالن", { exact: true }).first().click();
    await page.getByRole("button", { name: "تکمیل ثبت‌نام" }).click();
    const alerts = (await page.locator("[role=alert]").allInnerTexts()).filter(Boolean);
    // name, phone, password, terms: signup is intentionally short
    expect(alerts.length).toBeGreaterThanOrEqual(4);
    for (const message of alerts) expect(message).toMatch(persian);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("name"))).toBe("name");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("explains a wrong password in Persian", async () => {
    const client = createClient();
    const user = await registerUser(client, { type: "client" });
    const { page, context } = await newPage();
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "ورود" }).last().click();
    await page.fill("[name=phone]", user.phone);
    await page.fill("[name=password]", "not-the-password");
    await page.getByRole("button", { name: "ورود", exact: true }).last().click();
    await page.getByRole("alert").filter({ hasText: persian }).first().waitFor();
    await context.close();
  });
});

describe("booking flow (browser)", () => {
  it("client books through the UI, salon confirms through the UI, client sees it confirmed", async () => {
    const { name, client: salonClient } = await seedSalon();
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری تست" });

    // client: find the salon on «پیدا کردن» (the search box is always there), connect — which opens
    // its page straight away — and request a slot
    const clientView = await newPage({ cookie: clientApi.cookie() });
    const cp = clientView.page;
    await cp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openExploreTab(cp);
    await cp.getByPlaceholder("اسم، شماره یا لینک صفحه‌اش").fill(name);
    const result = cp.locator(".cnCard").filter({ hasText: name }).first();
    await result.getByRole("button", { name: "وصل شو" }).click();
    await cp.locator(".spvBarBook").click();
    await cp.locator(".sduItem").first().click();
    await cp.locator(".sduConfirm").click();
    // the booking form opens with the first free time already chosen; the button says which
    await cp.locator(".vbTime.is-on").waitFor();
    // the button says "checking" until the server has confirmed who does what at that time
    await cp.locator(".vbPlanRow").first().waitFor();
    await cp.getByRole("button", { name: /ارسال درخواست/ }).waitFor();
    // how long to wait for the salon: «صبر می‌کنم» unless the client picks the hour
    const waitChoice = cp.locator(".wc");
    expect(await waitChoice.getByRole("radio", { name: /صبر می‌کنم/ }).getAttribute("aria-checked")).toBe("true");
    await waitChoice.getByRole("radio", { name: /فقط ۱ ساعت/ }).click();
    expect(await waitChoice.getByRole("radio", { name: /فقط ۱ ساعت/ }).getAttribute("aria-checked")).toBe("true");
    await cp.locator(".vbSubmit").click();
    // "now what?": a full screen says the request reached the salon and how long the answer can take
    const receipt = cp.locator(".brScreen");
    await receipt.waitFor();
    expect(await receipt.innerText()).toContain(`درخواستت به ${name} رسید`);
    expect(await receipt.locator(".brCount").innerText()).toContain("دقیقه تا پاسخ سالن");
    expect(await receipt.locator(".brCount").innerText()).toContain("اگر جواب نداد، لغو می‌شود.");
    await cp.locator(".cbt.is-wait").waitFor({ state: "attached" });
    expect(await cp.locator(".cbt").innerText()).toContain("منتظر تأیید");
    // and takes the client home, where the new booking is the first card
    await receipt.getByRole("button", { name: "دیدن در «نوبت‌های من»" }).click();
    await receipt.waitFor({ state: "detached" });
    await cp.locator(".clientHome .cvCard.is-fresh", { hasText: name }).waitFor();
    expect(clientView.problems).toEqual([]);

    // salon: the new request opens on its own as the full booking screen; approve it there
    const salonView = await newPage({ cookie: salonClient.cookie() });
    const sp = salonView.page;
    await sp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const screen = sp.locator(".sbmScreen");
    await screen.waitFor();
    expect(await screen.innerText()).toContain("مشتری تست");
    for (const label of ["تغییر ساعت", "تماس", "بستن"]) {
      expect(await screen.locator(".sbmBar").getByRole("button", { name: label }).count()).toBe(1);
    }
    await screen.getByRole("button", { name: "تایید نوبت" }).click();
    await screen.waitFor({ state: "detached" });
    // answered once, it does not open again
    await sp.reload({ waitUntil: "networkidle" });
    expect(await sp.locator(".sbmScreen").count()).toBe(0);
    expect(salonView.problems).toEqual([]);

    // the client's booking list now says confirmed
    const list = await clientApi.get("/api/client-bookings");
    const statuses = JSON.stringify(list.payload);
    expect(statuses).toContain("تایید شده");
    await clientView.context.close();
    await salonView.context.close();
  });

  it("client books two services in one visit and is offered times from the server", async () => {
    const { name, client: salonClient, salon } = await seedSalon();
    await salonClient.post("/api/salon-services", { name: "مانیکور", price: "200000", duration: "30 دقیقه" });
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری دو خدمت" });
    expect((await clientApi.post("/api/connections", { targetUserId: salon.user.id })).ok).toBe(true);

    const clientView = await newPage({ cookie: clientApi.cookie() });
    const cp = clientView.page;
    await cp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openExploreTab(cp);
    await cp.locator(".cnCard").filter({ hasText: name }).first().getByRole("button", { name: `باز کردن ${name}` }).click();
    await cp.locator(".spvBarBook").click();
    await cp.locator(".sduItem").nth(0).click();
    await cp.locator(".sduItem").nth(1).click();
    const visitTimes = cp.waitForResponse((response) => response.url().includes("/api/salon-bookings/availability"));
    await cp.locator(".sduConfirm").click();
    expect((await visitTimes).ok()).toBe(true);
    // both services are listed with their own time, and who does each
    await cp.locator(".vbPlanRow").nth(1).waitFor();
    expect(await cp.locator(".vbPlanRow").count()).toBe(2);
    await cp.locator(".vbTime.is-on").waitFor();
    await cp.getByRole("button", { name: /ارسال درخواست/ }).waitFor();
    await cp.locator(".vbSubmit").click();
    // left on «صبر می‌کنم»: no countdown, just what happens if it takes long
    const receipt = cp.locator(".brScreen");
    await receipt.waitFor();
    expect(await receipt.locator(".brCount").count()).toBe(0);
    expect(await receipt.locator(".brWaitNote").innerText()).toContain("تا قبل از نوبت وقت دارد جواب بدهد");
    await cp.locator(".cbt.is-wait").waitFor({ state: "attached" });
    expect(clientView.problems).toEqual([]);

    const booking = (await salonClient.get("/api/salon-bookings")).payload.data.bookings[0];
    expect(booking.wait_minutes).toBeNull();
    expect(JSON.parse(booking.parts).map((part) => part.service).sort()).toEqual(["مانیکور", "کوتاهی مو"].sort());
    await clientView.context.close();
  });

  it("salon moves a client's booking; the client accepts the new time through the UI", async () => {
    const { client: salonClient, salon } = await seedSalon();
    const clientApi = createClient();
    const client = await registerUser(clientApi, { type: "client", name: "مشتری ساعت تازه" });
    const created = await clientApi.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: futureBookingDay(2), time: "10:00",
      client: client.user.name, phone: client.phone
    });
    expect(created.status).toBe(201);
    const id = created.payload.data.booking.id;
    expect((await salonClient.patch("/api/salon-bookings", { id, time: "12:00" })).payload.data.booking.status).toBe("در انتظار مشتری");

    const clientView = await newPage({ cookie: clientApi.cookie() });
    const cp = clientView.page;
    await cp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await cp.locator(".cbt.is-offer").click();
    const offer = cp.locator(".cbOffer");
    await offer.waitFor();
    expect(await offer.innerText()).toContain("۱۲:۰۰");
    await offer.getByRole("button", { name: "قبول ساعت تازه" }).click();
    await offer.waitFor({ state: "detached" });
    expect(clientView.problems).toEqual([]);
    const row = (await salonClient.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id);
    expect(row.status).toBe("تایید شده");
    expect(row.time).toBe("12:00");
    await clientView.context.close();
  });

  it("a new artist is shown the «+» once, and tapping it opens a new booking", async () => {
    const artistApi = createClient();
    await registerUser(artistApi, { type: "artist", name: "آرتیست تازه" });
    const { page, context, problems } = await newPage({ cookie: artistApi.cookie(), tipSeen: false });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const tip = page.locator(".createTip");
    await tip.waitFor();
    expect(await tip.innerText()).toContain("فهمیدم");
    await page.locator(".createTipHole").click();
    await tip.waitFor({ state: "detached" });
    await page.locator(".visitBookerSheet").waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    expect(await tip.count()).toBe(0);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("an artist answers a new booking right on their bookings tab", async () => {
    const artistApi = createClient();
    const artist = await registerUser(artistApi, { type: "artist", name: "آرتیست تست" });
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری مستقیم" });
    const created = await clientApi.post("/api/artist/bookings", {
      artistUserId: artist.user.id, service: "کوتاهی", bookingDate: futureBookingDay(2), time: "11:00", clientName: "مشتری مستقیم"
    });
    expect(created.payload.data.booking.status).toBe("تازه");

    const { page, context, problems } = await newPage({ cookie: artistApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.locator(".profileModeRail button", { hasText: "رزروها" }).click();
    // the booking is two days ahead: the notice names that day, and the card there has the buttons
    await page.locator(".artistBookingsPage .pendingOtherDays button").first().click();
    const card = page.locator(".artistBookingsPage .bkGroup").filter({ hasText: "مشتری مستقیم" });
    await card.getByRole("button", { name: "تایید" }).click();
    await card.waitFor({ state: "detached" });
    expect(problems).toEqual([]);
    const mine = (await artistApi.get("/api/artist/me")).payload.data.bookings;
    expect(mine.find((b) => b.id === created.payload.data.booking.id).status).toBe("تایید شده");
    await context.close();
  });
});

describe("client starts from what they want (browser)", () => {
  it("books straight from the «رزرو» tab: the followed salon's service, a time, then the receipt", async () => {
    const { name, salon } = await seedSalon();
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری خانه" });
    expect((await clientApi.post("/api/connections", { targetUserId: salon.user.id })).ok).toBe(true);

    const { page, context, problems } = await newPage({ cookie: clientApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    // the profile page is one page under the header (no «پروفایل / فعالیت من» switch) and no longer lists places
    expect(await page.locator(".profileModeRail").count()).toBe(0);
    expect(await page.locator(".chPlace").isVisible()).toBe(false);
    // «رزرو» opens on «سالن و آرتیست من»
    await page.locator("nav.bottomNav > button").nth(2).click();
    const place = page.locator(".chPlace");
    await place.waitFor();
    expect(await place.innerText()).toContain(name);
    await place.locator(".chServices button", { hasText: "کوتاهی مو" }).click();
    await page.locator(".sduItem.is-selected", { hasText: "کوتاهی مو" }).waitFor();
    await page.locator(".sduConfirm").click();
    await page.locator(".vbTime.is-on").waitFor();
    await page.getByRole("button", { name: /ارسال درخواست/ }).waitFor();
    await page.locator(".vbSubmit").click();
    const receipt = page.locator(".brScreen");
    await receipt.waitFor();
    // closing the salon page goes back to «سالن و آرتیست من»; the booking is under «نوبت‌های من» on the profile
    await receipt.getByRole("button", { name: "بستن" }).click();
    await receipt.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "بازگشت به سالن‌ها" }).click();
    await page.locator(".chPlace").waitFor();
    await page.locator("nav.bottomNav > button").nth(1).click();
    await page.locator(".clientHome .cvCard", { hasText: name }).waitFor();
    expect(problems).toEqual([]);
    await context.close();
  });


  it("one connected salon does it: straight to its services, the service already picked", async () => {
    const { name, client: salonClient, salon } = await seedSalon();
    await salonClient.post("/api/salon-services", { name: "کاشت ناخن", price: "900000", duration: "120 دقیقه" });
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری دسته" });
    expect((await clientApi.post("/api/connections", { targetUserId: salon.user.id })).ok).toBe(true);

    const { page, context, problems } = await newPage({ cookie: clientApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openExploreTab(page);
    await page.locator(".cnCat", { hasText: "ناخن" }).click();
    // the salon's page opens with its services menu, «کاشت ناخن» first and already picked
    await page.locator(".sduPanel").waitFor();
    expect(await page.locator(".sduPanel").getAttribute("aria-label")).toContain(name);
    await page.locator(".sduItem.is-selected", { hasText: "کاشت ناخن" }).waitFor();
    expect(await page.locator(".sduItem.is-selected").count()).toBe(1);
    expect(await page.locator(".sduGroup").first().getAttribute("aria-label")).toContain("ناخن");
    expect(problems).toEqual([]);
    await context.close();
  });

  it("nobody does it yet: connect by phone from the sheet; an unknown number gets a ready SMS invite", async () => {
    const { client: salonClient, salon } = await seedSalon();
    await salonClient.post("/api/salon-services", { name: "میکاپ ساده", price: "800000", duration: "60 دقیقه" });
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری میکاپ" });

    const { page, context, problems } = await newPage({ cookie: clientApi.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    // nobody followed yet: «سالن و آرتیست من» invites, and its link leads to «پیدا کردن»
    await page.locator("nav.bottomNav > button").nth(2).click();
    await page.locator("#cbt-panel .chEmpty").waitFor();
    await page.locator("#cbt-panel .chAddLink").click();
    await page.locator(".cnCat", { hasText: "میکاپ" }).waitFor();
    await page.locator(".cnCat", { hasText: "میکاپ" }).click();
    const sheet = page.locator(".cnSheetRoot");
    await sheet.waitFor();
    expect(await sheet.innerText()).toContain("هنوز کسی را وصل نکرده‌ای");

    // a number that is not on frfro: the client's own messages app gets the invite, with the category in it
    await sheet.getByPlaceholder("اسم، شماره یا لینک صفحه‌اش").fill("09129998877");
    await sheet.getByText("این شماره هنوز در فرفرو نیست.").waitFor();
    const href = await sheet.getByRole("link", { name: "پیامک دعوت" }).getAttribute("href");
    expect(href).toMatch(/^sms:09129998877\?&body=/);
    expect(decodeURIComponent(href)).toContain("برای «میکاپ»");

    // the salon's own number: connect, and its page opens on the services that match
    await sheet.getByPlaceholder("اسم، شماره یا لینک صفحه‌اش").fill(salon.phone);
    await sheet.getByRole("button", { name: "وصل شو" }).click();
    await page.locator(".sduPanel").waitFor();
    await page.locator(".sduItem.is-selected", { hasText: "میکاپ ساده" }).waitFor();
    const list = await clientApi.get("/api/connections");
    expect(list.payload.data.connections.map((c) => c.id)).toContain(salon.user.id);
    expect(problems).toEqual([]);
    await context.close();
  });
});

describe("client picks a salon from their contacts (browser)", () => {
  // Chrome on Android has a contact picker; the test stands in for it and returns one chosen contact.
  const withContacts = (contact) => `
    window.ContactsManager = function ContactsManager() {};
    Object.defineProperty(navigator, "contacts", { configurable: true, value: { select: async () => [${JSON.stringify(contact)}] } });
  `;

  it("a contact that is on frfro: connect and open; one that is not gets a ready SMS invite", async () => {
    const { client: salonClient, salon } = await seedSalon();
    await salonClient.post("/api/salon-services", { name: "کاشت ناخن", price: "900000", duration: "120 دقیقه" });
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری مخاطبین" });

    // a contact whose number is not on frfro
    const stranger = await newPage({ cookie: clientApi.cookie() });
    await stranger.context.addInitScript(withContacts({ name: ["خانم ناشناس"], tel: ["0912 000 1122"] }));
    await stranger.page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openExploreTab(stranger.page);
    await stranger.page.getByRole("button", { name: "از مخاطبین" }).click();
    const sheet = stranger.page.locator(".cnSheetRoot");
    await sheet.getByText("خانم ناشناس هنوز در فرفرو نیست.").waitFor();
    const href = await sheet.getByRole("link", { name: "پیامک دعوت" }).getAttribute("href");
    expect(href).toMatch(/^sms:09120001122\?&body=/);
    expect(stranger.problems).toEqual([]);
    await stranger.context.close();

    // a contact that is the salon: «وصل شو» connects and opens the salon page
    const known = await newPage({ cookie: clientApi.cookie() });
    await known.context.addInitScript(withContacts({ name: ["سالن من"], tel: ["021 5555 0000", salon.phone] }));
    await known.page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openExploreTab(known.page);
    await known.page.getByRole("button", { name: "از مخاطبین" }).click();
    await known.page.locator(".cnSheetRoot").getByRole("button", { name: "وصل شو" }).click();
    await known.page.locator(".spvBarBook").waitFor();
    const list = await clientApi.get("/api/connections");
    expect(list.payload.data.connections.map((c) => c.id)).toContain(salon.user.id);
    expect(known.problems).toEqual([]);
    await known.context.close();
  });
});

describe("QR scanning (browser)", () => {
  // The test stands in for the phone camera: a canvas stream showing `qrDataUrl`. The browser's own
  // reader is the kind many Android phones have (present, but never finds a code), so this proves
  // the scanner still reads codes when that reader is useless.
  const withCamera = (qrDataUrl) => `
    window.BarcodeDetector = class { static async getSupportedFormats() { return ["qr_code"]; } async detect() { return []; } };
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const context = canvas.getContext("2d");
    const image = new Image();
    image.src = ${JSON.stringify(qrDataUrl)};
    (function draw() {
      context.fillStyle = "#808080"; context.fillRect(0, 0, canvas.width, canvas.height);
      if (image.complete) context.drawImage(image, 520, 240, 240, 240);
      requestAnimationFrame(draw);
    })();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => canvas.captureStream(30) } });
  `;

  it("client scans a salon's code and connects; the salon scans the client's «کد من» and adds them", async () => {
    const { name, client: salonClient, salon } = await seedSalon();
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "مشتری اسکن" });

    const clientView = await newPage({ cookie: clientApi.cookie() });
    await clientView.context.addInitScript(withCamera(await QRCode.toDataURL(`${TEST_BASE_URL}/salons/${salon.user.id}`)));
    const cp = clientView.page;
    await cp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await openExploreTab(cp);
    await cp.getByRole("button", { name: "اسکن QR" }).click();
    const found = cp.locator(".cnScanResult").filter({ hasText: name });
    await found.getByRole("button", { name: "وصل شو" }).click();
    await found.getByRole("button", { name: "رزرو" }).waitFor();
    expect((await clientApi.get("/api/connections")).payload.data.connections.map((c) => c.id)).toContain(salon.user.id);
    expect(clientView.problems).toEqual([]);
    await clientView.context.close();

    const { code } = (await clientApi.get("/api/connections/code")).payload.data;
    const salonView = await newPage({ cookie: salonClient.cookie() });
    await salonView.context.addInitScript(withCamera(await QRCode.toDataURL(code)));
    const sp = salonView.page;
    await sp.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await sp.getByRole("button", { name: "مشتریان" }).click();
    await sp.locator(".cnScanCustomerBtn").first().click();
    // the client is already connected (they scanned the salon above), and the scanner says so
    await sp.locator(".cnScanResult").getByText("مشتری اسکن از قبل وصل بود.").waitFor();
    expect(salonView.problems).toEqual([]);
    await salonView.context.close();
  });
});

describe("mobile smoke (browser)", () => {
  it("every role renders at 360px with no horizontal scroll and no unnamed buttons", async () => {
    for (const type of ["client", "artist", "salon"]) {
      const api = createClient();
      await registerUser(api, { type, name: `نقش ${type}` });
      const { page, context, problems } = await newPage({ width: 360, cookie: api.cookie() });
      await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
      const nav = page.locator("nav.bottomNav > button");
      for (let i = 0; i < (await nav.count()); i++) {
        await nav.nth(i).click();
        await page.waitForTimeout(300);
        const report = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          unnamed: [...document.querySelectorAll("button,a")].filter((el) => el.getBoundingClientRect().width > 0 && !el.textContent.trim() && !el.getAttribute("aria-label") && !el.getAttribute("title")).length
        }));
        expect(report, `${type} tab ${i}`).toEqual({ overflow: false, unnamed: 0 });
      }
      expect(problems).toEqual([]);
      await context.close();
    }
  });
});

describe("accessibility (browser)", () => {
  it("has no serious or critical axe violations on the main screens of every role", async () => {
    const axePath = new URL("../../node_modules/axe-core/axe.min.js", import.meta.url).pathname;
    for (const type of ["client", "artist", "salon"]) {
      const api = createClient();
      await registerUser(api, { type, name: `نقش ${type}` });
      const { page, context } = await newPage({ cookie: api.cookie() });
      await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
      const nav = page.locator("nav.bottomNav > button");
      for (let i = 0; i < (await nav.count()); i++) {
        await nav.nth(i).click();
        await page.waitForTimeout(400);
        await page.addScriptTag({ path: axePath });
        const violations = await page.evaluate(async () => {
          const result = await axe.run(document, { resultTypes: ["violations"] });
          return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`);
        });
        expect(violations, `${type} tab ${i}`).toEqual([]);
      }
      await context.close();
    }
  }, 120_000);

  it("keeps keyboard focus inside a sheet and returns it to the opener on Escape", async () => {
    // The specialty picker lives in the profile edit sheet (signup no longer asks for it).
    const api = createClient();
    await registerUser(api, { type: "salon", name: "سالن فوکوس" });
    const { page, context } = await newPage({ cookie: api.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.locator("nav.bottomNav > button").nth(0).click();
    await page.locator("main button").filter({ hasText: "ویرایش برند سالن" }).first().click();
    const trigger = page.locator(".specialtySelectTrigger");
    await trigger.waitFor();
    await trigger.focus();
    await trigger.press("Enter");
    await page.locator(".specialtySheet").waitFor();
    await settleAnimations(page);
    expect(await page.evaluate(() => !!document.activeElement?.closest(".specialtySheet"))).toBe(true);
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".specialtySheet"))).toBe(true);
    await page.keyboard.press("Escape");
    await page.locator(".specialtySheet").waitFor({ state: "detached" });
    expect(await page.evaluate(() => document.activeElement?.className || "")).toContain("specialtySelectTrigger");
    await context.close();
  });
});

describe("profile completeness (browser)", () => {
  it("shows a new salon what is missing, and comes back after a refresh once closed", async () => {
    const api = createClient();
    await registerUser(api, { type: "salon", name: "سالن ناقص" });
    const { page, context } = await newPage({ cookie: api.cookie() });
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    const card = page.locator(".profileCompleteness");
    await card.waitFor();
    expect(await card.innerText()).toContain("۵ قدم تا پروفایل کامل");
    await page.getByRole("button", { name: "بستن یادآوری تکمیل پروفایل" }).click();
    await card.waitFor({ state: "detached" });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".profileCompleteness").waitFor();
    await context.close();
  });
});


// Finite animations only (a looping one never finishes), capped so a stuck one cannot hang the test.
async function settleAnimations(page) {
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      .map((a) => a.finished.catch(() => {}))),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]));
}

const TEST_PHOTO_PNG = "iVBORw0KGgoAAAANSUhEUgAAAFAAAABkCAIAAACemCBBAAAAiklEQVR4nO3PAQkAIBDAQGMbxzjGMoawP1iA3br7jGp9PwAGBgYGBgYeE3A94HrA9YDrAdcDrgdcD7gecD3gesD1gOsB1wOuB1wPuB5wPeB6wPWA6wHXA64HXA+4HnA94HrA9YDrAdcDrgdcD7gecD3gesD1gOsB1wOuB1wPuB5wPeB6wPWA6wHXe5RHm2dRl4OlAAAAAElFTkSuQmCC";

describe("dialogs (browser)", () => {
  it("the main owner dialogs have no serious or critical axe violations", async () => {
    const axePath = new URL("../../node_modules/axe-core/axe.min.js", import.meta.url).pathname;
    const checks = [
      ["artist", "رزرو دستی", (page) => page.locator("button.is-createBooking").click()],
      ["artist", "افزودن خدمت", async (page) => {
        await page.locator(".profileModeRail button", { hasText: "خدمات" }).click();
        await page.getByRole("button", { name: /افزودن خدمت/ }).first().click();
      }],
      ["artist", "ایجاد پست", async (page) => {
        await page.locator(".profileModeRail button", { hasText: "نمونه‌کار" }).click();
        // "Create post" opens the device gallery first; the picked photo goes to the crop step.
        const [chooser] = await Promise.all([
          page.waitForEvent("filechooser"),
          page.getByRole("button", { name: /ایجاد پست/ }).first().click()
        ]);
        await chooser.setFiles({ name: "post.png", mimeType: "image/png", buffer: Buffer.from(TEST_PHOTO_PNG, "base64") });
        // Confirm the crop: the sheet then shows the photo and the details form, which is what gets checked.
        await page.locator("[role=dialog]").last().getByRole("button", { name: /تایید کادر/ }).click();
        await page.locator(".artistWorkForm").waitFor();
      }],
      ["salon", "ویرایش پروفایل", async (page) => {
        await page.locator("nav.bottomNav > button").nth(0).click();
        await page.locator("main button").filter({ hasText: "ویرایش برند سالن" }).first().click();
      }]
    ];
    for (const [type, label, open] of checks) {
      const api = createClient();
      await registerUser(api, { type, name: `دیالوگ ${type}` });
      const { page, context } = await newPage({ cookie: api.cookie() });
      await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
      await open(page);
      await page.locator("[role=dialog]").last().waitFor();
      // axe reads colours as rendered: let the opening animation finish or it measures a half-faded dialog.
      await settleAnimations(page);
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => {
        const dialogs = document.querySelectorAll("[role=dialog]");
        const result = await axe.run(dialogs[dialogs.length - 1], { resultTypes: ["violations"] });
        return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`);
      });
      expect(violations, `${type} ${label}`).toEqual([]);
      await context.close();
    }
  }, 120_000);
});

describe("admin page (browser)", () => {
  it("shows only a login form to anyone without an admin session, then walks the real setup and login flow", async () => {
    const { TEST_ADMIN3_PHONE, TEST_ADMIN_PASSWORD, TEST_ADMIN_SETUP_KEY } = await import("../globalSetup.js");
    const { totpCodeAt, totpStepAt } = await import("../../app/lib/totp.js");

    // A normal user's login opens nothing: /admin shows the admin login form, never the panel.
    const normal = createClient();
    await registerUser(normal, { type: "client", name: "عادی" });
    const denied = await newPage({ cookie: normal.cookie() });
    await denied.page.goto(`${TEST_BASE_URL}/admin`, { waitUntil: "networkidle" });
    expect(await denied.page.locator("main").innerText()).toContain("ورود مدیریت");
    expect(await denied.page.locator(".admTabs").count()).toBe(0);
    await denied.context.close();

    await registerUser(createClient(), { type: "client", name: "Admin Three", phone: TEST_ADMIN3_PHONE });
    const { page, context, problems } = await newPage({ width: 1100 });
    await page.goto(`${TEST_BASE_URL}/admin`, { waitUntil: "networkidle" });

    // First-time setup: password + setup key -> QR/secret -> first code -> inside the panel.
    await page.getByRole("button", { name: /راه‌اندازی اولیه/ }).click();
    await page.getByLabel("شمارهٔ موبایل").fill(TEST_ADMIN3_PHONE);
    await page.getByLabel("رمز عبور").fill(TEST_ADMIN_PASSWORD);
    await page.getByLabel(/کلید راه‌اندازی/).fill(TEST_ADMIN_SETUP_KEY);
    await page.getByRole("button", { name: "ادامه" }).click();
    await page.locator(".admKey").waitFor();
    const secret = (await page.locator(".admKey").innerText()).trim();
    const usedStep = totpStepAt();
    await page.getByLabel("کد ۶ رقمی").fill(totpCodeAt(secret, usedStep));
    await page.getByRole("button", { name: "فعال‌سازی و ورود" }).click();
    // The rail is the page menu: one button per page (a waiting count may follow the name).
    const nav = (name) => page.locator(".admSideNav").getByRole("button", { name: new RegExp(`^${name}`) });
    await nav("کاربران").waitFor();
    await nav("کاربران").click();
    await page.locator(".admTable tbody tr").first().waitFor();
    expect(page.url()).toContain("p=users");
    await nav("نمای کلی").click();
    await page.locator(".admLiveStrip").waitFor();
    expect(await page.locator(".admDash").innerText()).toContain("کل کاربران");

    // The left rail starts open with labels, and closes to icons only from its top button.
    const rail = page.locator(".admSide");
    expect(await rail.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(200);
    await page.getByRole("button", { name: "جمع‌کردن منو" }).click();
    await page.waitForFunction(() => document.querySelector(".admSide").getBoundingClientRect().width < 100);
    await page.getByRole("button", { name: "باز‌کردن منو" }).click();

    // The other pages open without errors.
    for (const name of ["محتوا", "رزروها", "پشتیبانی", "پیام همگانی", "گزارش‌ها", "سلامت سامانه", "تنظیمات", "امنیت و دسترسی"]) {
      await nav(name).click();
      await page.locator(".admCard").first().waitFor();
    }
    expect(await page.locator("main").innerText()).toContain("نشست‌های فعال پنل");
    await nav("کاربران").click();
    await page.locator(".admTable tbody .admRowLink").first().click();
    await page.locator(".admDetail").waitFor();
    // On a narrow screen the details cover the page; "back to list" closes them.
    const back = page.locator(".admSplitBack");
    if (await back.isVisible()) await back.click();

    // Logout, then a normal login with the next code.
    await page.getByRole("button", { name: "خروج", exact: true }).click();
    await page.getByRole("button", { name: "ورود", exact: true }).waitFor();
    await page.getByLabel("شمارهٔ موبایل").fill(TEST_ADMIN3_PHONE);
    await page.getByLabel("رمز عبور").fill(TEST_ADMIN_PASSWORD);
    await page.getByLabel(/کد ۶ رقمی/).fill(totpCodeAt(secret, usedStep + 1));
    await page.getByRole("button", { name: "ورود", exact: true }).click();
    await page.locator(".admSideNav").getByRole("button", { name: "نمای کلی" }).waitFor();
    expect(problems).toEqual([]);
    await context.close();
  }, 60_000);
});

describe("support (browser)", () => {
  it("a user writes to support from the floating button, gets the admin's reply with an unread badge, and keeps talking", async () => {
    const { adminClient } = await import("../integration/helpers.js");
    const axePath = new URL("../../node_modules/axe-core/axe.min.js", import.meta.url).pathname;
    const userApi = createClient();
    await registerUser(userApi, { type: "client", name: "کاربر پشتیبانی" });
    const { page, context, problems } = await newPage({ cookie: userApi.cookie() });

    // The floating button is there; open the centre and write a new message.
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "پشتیبانی", exact: true }).click();
    const center = page.getByRole("dialog", { name: "پشتیبانی" });
    await center.waitFor();
    await settleAnimations(page);
    await page.addScriptTag({ path: axePath });
    const axeIssues = () => page.evaluate(async () => {
      const result = await axe.run(document.querySelector(".scSheet"), { resultTypes: ["violations"] });
      return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`);
    });
    expect(await axeIssues()).toEqual([]);
    await center.getByRole("button", { name: /پیام جدید به پشتیبانی/ }).click();
    await center.getByLabel("پیامت").fill("سلام، این یک پیام آزمایشی از مرورگر برای پشتیبانی است.");
    await center.getByRole("button", { name: "ارسال پیام" }).click();
    await center.getByText("سلام، این یک پیام آزمایشی از مرورگر برای پشتیبانی است.").waitFor();
    expect(await axeIssues()).toEqual([]);

    // The admin answers; after a reload the button shows an unread badge and the reply is in the conversation.
    const admin = await adminClient();
    const inbox = (await admin.get("/api/admin/support?kind=support&q=" + encodeURIComponent("پیام آزمایشی از مرورگر"))).payload.data;
    expect(inbox.tickets.length).toBeGreaterThan(0);
    expect((await admin.post(`/api/admin/support/${inbox.tickets[0].id}`, { reply: "سلام! مشکل را بررسی کردیم." })).ok).toBe(true);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /پشتیبانی، 1 پاسخ جدید/ }).click();
    await page.getByRole("dialog", { name: "پشتیبانی" }).getByText("پاسخ داده شد").first().waitFor();
    await page.locator(".scList button").first().click();
    await page.getByText("سلام! مشکل را بررسی کردیم.").waitFor();
    await settleAnimations(page);
    await page.addScriptTag({ path: axePath });
    expect(await axeIssues()).toEqual([]);

    // Keep the conversation going.
    await page.getByLabel("پیام", { exact: true }).fill("ممنون، حل شد.");
    await page.getByRole("button", { name: "ارسال", exact: true }).click();
    // Wait for the sent bubble, not just the text: a typed textarea also carries its value as text, so getByText
    // could match the box itself while the message is still on its way (and closing the page would drop it).
    await page.locator(".scMsg.is-user", { hasText: "ممنون، حل شد." }).waitFor();
    expect(problems).toEqual([]);
    await context.close();
    await expect.poll(async () => (await admin.get(`/api/admin/support/${inbox.tickets[0].id}`)).payload.data.messages.map((message) => message.author)).toEqual(["user", "admin", "user"]);
  }, 90_000);
});

describe("SMS code at sign-up (browser)", () => {
  it("asks for the texted code, then creates the account", async () => {
    const { adminClient, uniquePhone } = await import("../integration/helpers.js");
    const admin = await adminClient();
    const phone = uniquePhone();
    const { page, context, problems } = await newPage();
    // Pretend sign-up requires a code (the shared test server leaves it optional).
    await page.route("**/api/auth/otp/config", (route) => route.fulfill({ json: { data: { enabled: true, required: true, resendSeconds: 60 } } }));
    await page.goto(TEST_BASE_URL, { waitUntil: "networkidle" });
    await page.getByText("مشتری", { exact: true }).first().click();
    await page.fill("[name=name]", "مشتری کدی");
    await page.fill("[name=area]", "تهران");
    await page.fill("[name=phone]", phone);
    await page.fill("[name=password]", "testpass123");
    await page.locator("[name=agreeTerms]").check();
    await page.getByRole("button", { name: "ادامه و تأیید شماره" }).click();
    await page.locator("[name=otpCode]").waitFor();
    // wrong code first: Persian error, still on the code step
    await page.fill("[name=otpCode]", "00000");
    await page.getByRole("button", { name: "تأیید و ساخت حساب" }).click();
    await page.getByRole("alert").filter({ hasText: persian }).first().waitFor();
    // the real code
    let code = null;
    for (let i = 0; i < 20 && !code; i += 1) {
      code = (await admin.get(`/api/admin/sms?phone=${phone}`)).payload.data.latestTestCode;
      if (!code) await page.waitForTimeout(250);
    }
    await page.fill("[name=otpCode]", code);
    await page.getByRole("button", { name: "تأیید و ساخت حساب" }).click();
    await page.locator("nav.bottomNav").waitFor();
    const me = await page.evaluate(async () => (await (await fetch("/api/auth/me")).json()).data.user?.phone);
    expect(me).toBe(phone);
    expect(problems).toEqual([]);
    await context.close();
  });
});
