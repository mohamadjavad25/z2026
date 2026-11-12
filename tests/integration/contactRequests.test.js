import { describe, it, expect, afterAll } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser, uniquePhone } from "./helpers.js";
import { FAR_DAY, cron, db, newClient, newSalon, q, slotAhead, smsEventually, smsSettled } from "./exitHelpers.js";

/**
 * Owner, 2026-11-12: a client picks a service and a time, and when none of their salons does it, picks their salon
 * from the phone's contacts; frfro texts that number a link, and once it signs up as a salon or artist the request
 * is a normal booking request there. Rules (owner's answers the same day): one SMS a day to a number, three requests
 * a day per client, a client's number is refused, a request closes three hours before its time.
 */
afterAll(() => db.end());

const send = (client, body) => client.api.post("/api/contact-requests", {
  service: "ژلیش ناخن",
  serviceEmoji: "nail_polish",
  bookingDate: FAR_DAY(3),
  time: "11:00",
  contactName: "سالن مخاطب",
  ...body
});
const requestRow = async (id) => (await q("SELECT * FROM contact_requests WHERE id = $1", [id]))[0];
const codeOf = async (id) => (await requestRow(id)).code;

describe("sending a request to a number not on frfro", () => {
  it("texts the number once with the client's name, the service and the link", async () => {
    const client = await newClient("مشتری مخاطب");
    const phone = uniquePhone();
    const made = await send(client, { phone });
    expect(made.status).toBe(201);
    expect(made.payload.data.sms).toBe("sent");
    expect(made.payload.data.request).toMatchObject({ status: "waiting", service: "ژلیش ناخن", phoneEnd: phone.slice(-4) });
    expect(made.payload.data.request.link).toBeUndefined();
    const texts = await smsEventually(phone, "contact_request", 1);
    const code = await codeOf(made.payload.data.request.id);
    expect(texts[0].body).toContain("مشتری مخاطب");
    expect(texts[0].body).toContain("ژلیش ناخن");
    expect(texts[0].body).toContain(`frfro.ir/r/${code}`);
  });

  it("a second request to the same number that day waits on the same page, without a second SMS", async () => {
    const first = await newClient("مشتری یک");
    const second = await newClient("مشتری دو");
    const phone = uniquePhone();
    expect((await send(first, { phone })).payload.data.sms).toBe("sent");
    const again = await send(second, { phone, time: "15:00" });
    expect(again.status).toBe(201);
    expect(again.payload.data.sms).toBe("joined");
    expect(await smsSettled(phone, ["contact_request"])).toBe(1);
    const page = await fetch(`${TEST_BASE_URL}/r/${await codeOf(again.payload.data.request.id)}`);
    const html = await page.text();
    expect(html).toContain("مشتری یک");
    expect(html).toContain("مشتری دو");
  });

  it("the same request twice is one request", async () => {
    const client = await newClient("مشتری تکراری");
    const phone = uniquePhone();
    const one = await send(client, { phone });
    const two = await send(client, { phone });
    expect(two.status).toBe(200);
    expect(two.payload.data.request.id).toBe(one.payload.data.request.id);
  });

  it("a salon already on frfro is found instead, with no SMS", async () => {
    const salon = await newSalon("Contact Found Salon");
    const client = await newClient("مشتری پیدا");
    const found = await send(client, { phone: salon.phone });
    expect(found.status).toBe(200);
    expect(found.payload.data.found).toMatchObject({ id: salon.id, type: "salon" });
    expect(await smsSettled(salon.phone, ["contact_request"])).toBe(0);
  });

  it("refuses a client's number, the client's own number, and a time under three hours away", async () => {
    const other = await newClient("مشتری دیگه");
    const client = await newClient("مشتری رد");
    expect((await send(client, { phone: other.phone })).payload.code).toBe("CLIENT_NUMBER");
    expect((await send(client, { phone: client.phone })).payload.code).toBe("OWN_NUMBER");
    const soon = slotAhead(120);
    const early = await send(client, { phone: uniquePhone(), bookingDate: soon.date, time: soon.time });
    expect(early.status).toBe(400);
    expect(early.payload.code).toBe("BAD_TIME");
    expect((await send(client, { phone: "02133334444" })).payload.code).toBe("NOT_MOBILE");
  });

  it("three a day per client", async () => {
    const client = await newClient("مشتری سه‌تا");
    for (let i = 0; i < 3; i += 1) expect((await send(client, { phone: uniquePhone() })).status).toBe(201);
    const fourth = await send(client, { phone: uniquePhone() });
    expect(fourth.status).toBe(409);
    expect(fourth.payload.code).toBe("DAILY_LIMIT");
  });

  it("only clients send them", async () => {
    const salon = await newSalon("Contact Not Client Salon");
    expect((await send({ api: salon.api }, { phone: uniquePhone() })).status).toBe(403);
  });
});

describe("the link page", () => {
  it("shows the waiting request, and an unknown code is not found", async () => {
    const client = await newClient("مشتری صفحه");
    const made = await send(client, { phone: uniquePhone(), service: "کوتاهی مو" });
    const page = await fetch(`${TEST_BASE_URL}/r/${await codeOf(made.payload.data.request.id)}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("کوتاهی مو");
    expect(html).toContain("مشتری صفحه");
    expect(html).not.toContain(client.phone);
    expect((await fetch(`${TEST_BASE_URL}/r/NoSuchCode1`)).status).toBe(404);
  });

  it("«دیگه پیام نده» declines what waits and refuses new requests to that number", async () => {
    const client = await newClient("مشتری نخواست");
    const phone = uniquePhone();
    const made = await send(client, { phone });
    const code = await codeOf(made.payload.data.request.id);
    const stop = await createClient().post("/api/contact-requests/opt-out", { code });
    expect(stop.status).toBe(200);
    expect((await requestRow(made.payload.data.request.id)).status).toBe("declined");
    const list = await client.api.get("/api/contact-requests");
    expect(list.payload.data.requests[0]).toMatchObject({ id: made.payload.data.request.id, status: "declined" });
    const other = await newClient("مشتری بعدی");
    const refused = await send(other, { phone });
    expect(refused.payload.code).toBe("OPTED_OUT");
  });
});

describe("when the number joins frfro", () => {
  it("a salon signing up with that number (proven) gets the request as a booking request, and the client is connected", async () => {
    const client = await newClient("مشتری رسید");
    const phone = uniquePhone();
    const day = FAR_DAY(4);
    const made = await send(client, { phone, bookingDate: day, time: "12:00" });
    const salonApi = createClient();
    const reg = await registerUser(salonApi, { type: "salon", name: `Contact Joined Salon ${phone.slice(-5)}`, phone, verified: true });
    const row = await requestRow(made.payload.data.request.id);
    expect(row).toMatchObject({ status: "delivered", booking_kind: "salon", business_user_id: reg.user.id });
    const [booking] = await q("SELECT * FROM salon_bookings WHERE id = $1", [row.booking_id]);
    expect(booking).toMatchObject({ salon_user_id: reg.user.id, client_user_id: client.id, service: "ژلیش ناخن", booking_date: day, time: "12:00", status: "درخواست", wait_minutes: null });
    const follows = await q("SELECT 1 FROM follows WHERE follower_user_id = $1 AND target_user_id = $2", [client.id, reg.user.id]);
    expect(follows).toHaveLength(1);
    // The service is on the new salon's menu, so it is the salon's to answer like any request.
    const menu = await salonApi.get("/api/salon-services");
    expect(JSON.stringify(menu.payload)).toContain("ژلیش ناخن");
    const answered = await salonApi.patch("/api/salon-bookings", { id: booking.id, status: "تایید شده" });
    expect(answered.status, JSON.stringify(answered.payload)).toBe(200);
  });

  it("a sign-up that did not prove the number takes nothing by the number alone", async () => {
    const client = await newClient("مشتری بی‌کد");
    const phone = uniquePhone();
    const made = await send(client, { phone });
    await registerUser(createClient(), { type: "salon", name: `Contact Unproven Salon ${phone.slice(-5)}`, phone });
    expect((await requestRow(made.payload.data.request.id)).status).toBe("waiting");
  });

  it("an artist with another number takes them with the link's code", async () => {
    const client = await newClient("مشتری آرتیست");
    const phone = uniquePhone();
    const made = await send(client, { phone, service: "اکستنشن مژه", serviceEmoji: "lash_ext" });
    const code = await codeOf(made.payload.data.request.id);
    const artistApi = createClient();
    const reg = await registerUser(artistApi, { type: "artist", name: `Contact Artist ${phone.slice(-5)}` });
    const claim = await artistApi.post("/api/contact-requests/claim", { code });
    expect(claim.status).toBe(200);
    expect(claim.payload.data.count).toBe(1);
    const row = await requestRow(made.payload.data.request.id);
    expect(row).toMatchObject({ status: "delivered", booking_kind: "artist" });
    const [booking] = await q("SELECT * FROM artist_bookings WHERE id = $1", [row.booking_id]);
    expect(booking).toMatchObject({ artist_user_id: reg.user.id, client_user_id: client.id, service: "اکستنشن مژه", status: "تازه" });
    // A client cannot claim; a claimed link shows it is done.
    expect((await client.api.post("/api/contact-requests/claim", { code })).status).toBe(403);
    const html = await (await fetch(`${TEST_BASE_URL}/r/${code}`)).text();
    expect(html).toContain("درخواست‌ها توی حسابته");
  });
});

describe("closing", () => {
  it("the client takes a waiting request back", async () => {
    const client = await newClient("مشتری پشیمون");
    const made = await send(client, { phone: uniquePhone() });
    const id = made.payload.data.request.id;
    expect((await client.api.delete("/api/contact-requests", { id })).status).toBe(200);
    expect((await requestRow(id)).status).toBe("cancelled");
    expect((await client.api.get("/api/contact-requests")).payload.data.requests.find((row) => row.id === id)).toBeUndefined();
    expect((await client.api.delete("/api/contact-requests", { id })).status).toBe(409);
  });

  it("nobody signed up: it closes three hours before its time", async () => {
    const client = await newClient("مشتری بی‌جواب");
    const made = await send(client, { phone: uniquePhone() });
    const id = made.payload.data.request.id;
    const near = slotAhead(150);
    await q("UPDATE contact_requests SET booking_date = $2, time = $3 WHERE id = $1", [id, near.date, near.time]);
    const swept = await cron("expire-bookings");
    expect(swept.status).toBe(200);
    expect((await requestRow(id)).status).toBe("expired");
    const list = await client.api.get("/api/contact-requests");
    expect(list.payload.data.requests.find((row) => row.id === id)).toMatchObject({ status: "expired" });
  });
});

describe("which of the client's places do a service", () => {
  it("matches the menu by the service, not by the field", async () => {
    const salonApi = createClient();
    const salon = (await registerUser(salonApi, { type: "salon", name: "Contact Menu Salon", menu: [["مانیکور", "60 دقیقه"], ["رنگ مو", "60 دقیقه"]] })).user;
    const client = await newClient("مشتری منو");
    await client.api.post("/api/connections", { targetUserId: salon.id });
    const manicure = await client.api.get("/api/connections/by-service?service=manicure");
    expect(manicure.payload.data.matches.map((match) => match.id)).toEqual([salon.id]);
    expect(manicure.payload.data.matches[0].services).toContain("مانیکور");
    const gelish = await client.api.get("/api/connections/by-service?service=gelish");
    expect(gelish.payload.data.matches).toEqual([]);
    const typed = await client.api.get(`/api/connections/by-service?name=${encodeURIComponent("رنگ مو")}`);
    expect(typed.payload.data.matches.map((match) => match.id)).toEqual([salon.id]);
  });
});

