import { describe, it, expect, afterAll } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser, uniquePhone } from "./helpers.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";
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
    // Only the first name, in Persian letters (code review 2026-11-12: nothing but plain words in frfro's SMS).
    expect(texts[0].body).toContain("مشتری برای ژلیش ناخن");
    expect(texts[0].body).toContain("ژلیش ناخن");
    expect(texts[0].body).toContain(`frfro.ir/r/${code}`);
  });

  it("a second request to the same number that day waits on the same page, without a second SMS", async () => {
    const first = await newClient("مشتری یک");
    const second = await newClient("مشتری دو");
    const phone = uniquePhone();
    const sent = await send(first, { phone });
    expect(sent.payload.data.sms).toBe("sent");
    const again = await send(second, { phone, time: "15:00" });
    expect(again.status).toBe(201);
    expect(again.payload.data.sms).toBe("joined");
    expect(await smsSettled(phone, ["contact_request"])).toBe(1);
    // The link in the SMS frfro sent shows both.
    const page = await fetch(`${TEST_BASE_URL}/r/${await codeOf(sent.payload.data.request.id)}`);
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

describe("what a link's code reaches (code review 2026-11-12)", () => {
  const nextFriday = () => {
    for (let i = 1; i < 10; i += 1) {
      const day = new Date(Date.now() + i * 86400000);
      if (getPersianWeekday(day) === "جمعه") return formatPersianDateKey(day);
    }
    throw new Error("no Friday");
  };

  it("a link a client sent from their own phone shows and hands over only that client's request", async () => {
    const a = await newClient("مشتری الف");
    const b = await newClient("مشتری ب");
    const phone = uniquePhone();
    const one = (await send(a, { phone })).payload.data.request.id;
    const two = (await send(b, { phone, time: "15:00" })).payload.data.request.id;
    // As when SMS is not set up: each client got their own link to send.
    await q("UPDATE contact_requests SET sms_status = 'off' WHERE id = ANY($1)", [[one, two]]);
    const code = await codeOf(one);
    const html = await (await fetch(`${TEST_BASE_URL}/r/${code}`)).text();
    expect(html).toContain("مشتری الف");
    expect(html).not.toContain("مشتری ب");
    const stranger = createClient();
    await registerUser(stranger, { type: "salon", name: `Contact Stranger ${phone.slice(-5)}` });
    expect((await stranger.post("/api/contact-requests/claim", { code })).payload.data.count).toBe(1);
    expect((await requestRow(two)).status).toBe("waiting");
    // Its «دیگه پیام نده» declines only that request and blocks nothing.
    const third = (await send(b, { phone, time: "17:00" })).payload.data.request.id;
    await q("UPDATE contact_requests SET sms_status = 'off' WHERE id = $1", [third]);
    expect((await createClient().post("/api/contact-requests/opt-out", { code: await codeOf(third) })).status).toBe(200);
    expect((await requestRow(two)).status).toBe("waiting");
    expect((await q("SELECT 1 FROM contact_request_optouts WHERE phone = $1", [phone]))).toHaveLength(0);
  });

  it("an old code after its request was handed over: another account gets nothing, the same one gets 0", async () => {
    const client = await newClient("مشتری کهنه");
    const phone = uniquePhone();
    const made = await send(client, { phone });
    const code = await codeOf(made.payload.data.request.id);
    const salonApi = createClient();
    await registerUser(salonApi, { type: "salon", name: `Contact Old Code ${phone.slice(-5)}` });
    expect((await salonApi.post("/api/contact-requests/claim", { code })).payload.data.count).toBe(1);
    expect((await salonApi.post("/api/contact-requests/claim", { code })).payload.data.count).toBe(0);
    const other = createClient();
    await registerUser(other, { type: "artist", name: `Contact Old Code Artist ${phone.slice(-5)}` });
    expect((await other.post("/api/contact-requests/claim", { code })).status).toBe(404);
    // A later client's request to that number is not reached by the old code.
    const later = await send(await newClient("مشتری بعدتر"), { phone: uniquePhone() });
    expect((await other.post("/api/contact-requests/claim", { code })).status).toBe(404);
    expect((await requestRow(later.payload.data.request.id)).status).toBe("waiting");
    expect((await createClient().post("/api/contact-requests/opt-out", { code })).status).toBe(404);
  });

  it("a new salon can accept a request outside its default hours (Friday, 21:00)", async () => {
    const client = await newClient("مشتری جمعه");
    const phone = uniquePhone();
    const made = await send(client, { phone, bookingDate: nextFriday(), time: "21:00" });
    expect(made.status).toBe(201);
    const salonApi = createClient();
    await registerUser(salonApi, { type: "salon", name: `Contact Friday Salon ${phone.slice(-5)}`, phone, verified: true });
    const row = await requestRow(made.payload.data.request.id);
    const answered = await salonApi.patch("/api/salon-bookings", { id: row.booking_id, status: "تایید شده" });
    expect(answered.status, JSON.stringify(answered.payload)).toBe(200);
  });

  it("only plain words of a typed service go into the SMS and the menu", async () => {
    const client = await newClient("Client Latin");
    const phone = uniquePhone();
    const made = await send(client, { phone, service: "ناخن http://bad.example ۰۹۱۲۳۴۵۶۷۸۹ زنگ بزن", serviceEmoji: "" });
    expect(made.status).toBe(201);
    const row = await requestRow(made.payload.data.request.id);
    expect(row.service).toBe("ناخن زنگ بزن");
    const [sms] = await smsEventually(phone, "contact_request", 1);
    expect(sms.body).toContain("یه مشتری برای ناخن زنگ بزن");
    expect(sms.body).not.toContain("bad.example");
    expect((await send(client, { phone: uniquePhone(), service: "http://x.co" })).payload.code).toBe("NO_SERVICE");
  });
});


describe("the number is already on frfro (owner's report, 2026-11-12: «درخواستی که انتخاب کردم گم شد»)", () => {
  const salonWith = async (name, menu) => {
    const api = createClient();
    const reg = await registerUser(api, { type: "salon", name, menu });
    return { api, ...reg, id: reg.user.id };
  };

  it("a salon with no services gets the request straight away, as a normal request it can accept", async () => {
    const salon = await salonWith("Contact Empty Salon", false);
    const client = await newClient("خواهر");
    const day = FAR_DAY(3);
    const sent = await send(client, { phone: salon.phone, service: "پدیکور", serviceEmoji: "pedicure", bookingDate: day, time: "21:00" });
    expect(sent.status).toBe(201);
    expect(sent.payload.data).toMatchObject({ direct: true, place: { id: salon.id } });
    const [row] = await q("SELECT * FROM contact_requests WHERE client_user_id = $1", [client.id]);
    expect(row).toMatchObject({ status: "delivered", sms_status: "direct", business_user_id: salon.id, booking_kind: "salon" });
    const [booking] = await q("SELECT * FROM salon_bookings WHERE id = $1", [row.booking_id]);
    expect(booking).toMatchObject({ client_user_id: client.id, service: "پدیکور", booking_date: day, time: "21:00", status: "درخواست" });
    // The salon is told with the approved «درخواست نوبت» SMS (no push reached it here); no SMS link goes out.
    expect(await smsEventually(salon.phone, "booking_request", 1)).toHaveLength(1);
    expect(await smsSettled(salon.phone, ["contact_request"])).toBe(0);
    expect(await q("SELECT 1 FROM follows WHERE follower_user_id = $1 AND target_user_id = $2", [client.id, salon.id])).toHaveLength(1);
    // «اضافه کن و قبول کن»: accepted outside its hours, and the service is now on its menu.
    const answered = await salon.api.patch("/api/salon-bookings", { id: booking.id, status: "تایید شده" });
    expect(answered.status, JSON.stringify(answered.payload)).toBe(200);
    const menu = await salon.api.get("/api/salon-services");
    expect(menu.payload.data.services.map((item) => item.name)).toContain("پدیکور");
    // A second tap on «بفرست» is the same request, not a second one.
    const again = await send(client, { phone: salon.phone, service: "پدیکور", serviceEmoji: "pedicure", bookingDate: day, time: "21:00" });
    expect(again.status).toBe(200);
    expect(await q("SELECT 1 FROM salon_bookings WHERE salon_user_id = $1", [salon.id])).toHaveLength(1);
  });

  it("only a package with the service in it is not the service: the request goes straight to the salon", async () => {
    const salon = await salonWith("Contact Package Salon", [["پکیج مانیکور و پدیکور", "90 دقیقه"]]);
    const client = await newClient("مشتری پکیج");
    const sent = await send(client, { phone: salon.phone, service: "پدیکور", serviceEmoji: "pedicure" });
    expect(sent.status).toBe(201);
    expect(sent.payload.data.direct).toBe(true);
  });

  it("a salon that does the service: its booking form opens on the chosen day and hour, nothing is sent", async () => {
    const salon = await salonWith("Contact Pedicure Salon", [["پدیکور", "60 دقیقه"]]);
    const client = await newClient("مشتری پدیکور");
    const sent = await send(client, { phone: salon.phone, service: "پدیکور", serviceEmoji: "pedicure" });
    expect(sent.status).toBe(200);
    expect(sent.payload.data).toMatchObject({ found: { id: salon.id }, services: ["پدیکور"] });
    expect(await q("SELECT 1 FROM salon_bookings WHERE salon_user_id = $1", [salon.id])).toHaveLength(0);
    expect(await q("SELECT 1 FROM contact_requests WHERE client_user_id = $1", [client.id])).toHaveLength(0);
  });

  it("an artist with no services gets it as her own request, and accepting puts it on her menu", async () => {
    const artistApi = createClient();
    const artist = await registerUser(artistApi, { type: "artist", name: "Contact Empty Artist" });
    const client = await newClient("مشتری آرتیست خالی");
    const sent = await send(client, { phone: artist.phone, service: "پدیکور", serviceEmoji: "pedicure" });
    expect(sent.status).toBe(201);
    const [row] = await q("SELECT * FROM contact_requests WHERE client_user_id = $1", [client.id]);
    const [booking] = await q("SELECT * FROM artist_bookings WHERE id = $1", [row.booking_id]);
    expect(booking).toMatchObject({ artist_user_id: artist.user.id, status: "تازه", service: "پدیکور" });
    const answered = await artistApi.patch("/api/artist/me", { kind: "booking", id: booking.id, status: "تایید شده" });
    expect(answered.status, JSON.stringify(answered.payload)).toBe(200);
    const me = await artistApi.get("/api/artist/me");
    expect(JSON.stringify(me.payload)).toContain("پدیکور");
  });

  it("these count toward the client's three a day", async () => {
    const client = await newClient("مشتری سه مستقیم");
    for (let i = 0; i < 3; i += 1) {
      const salon = await salonWith(`Contact Daily Salon ${i}`, false);
      expect((await send(client, { phone: salon.phone, service: "پدیکور" })).status).toBe(201);
    }
    const fourth = await salonWith("Contact Daily Salon 3", false);
    expect((await send(client, { phone: fourth.phone, service: "پدیکور" })).payload.code).toBe("DAILY_LIMIT");
  });
});

describe("«کاری که می‌خوای اینجا نیست؟» on a place's page (owner, 2026-11-12)", () => {
  const salonWith = async (name, menu) => {
    const api = createClient();
    const reg = await registerUser(api, { type: "salon", name, menu });
    return { api, ...reg, id: reg.user.id };
  };
  const ask = (client, placeId, body = {}) => client.api.post("/api/contact-requests", {
    placeId, service: "پدیکور", serviceEmoji: "pedicure", bookingDate: FAR_DAY(3), time: "12:00", ...body
  });

  it("only a package with it: the single service goes to that salon as a request", async () => {
    const salon = await salonWith("Contact Page Package Salon", [["پکیج مانیکور و پدیکور", "90 دقیقه"]]);
    const client = await newClient("مشتری صفحه پکیج");
    const sent = await ask(client, salon.id);
    expect(sent.status, JSON.stringify(sent.payload)).toBe(201);
    const [row] = await q("SELECT * FROM contact_requests WHERE client_user_id = $1", [client.id]);
    expect(row).toMatchObject({ status: "delivered", booking_kind: "salon", business_user_id: salon.id, service: "پدیکور" });
  });

  it("it has the service after all: the booking form opens instead, nothing is sent", async () => {
    const salon = await salonWith("Contact Page Has Salon", [["پدیکور", "60 دقیقه"]]);
    const client = await newClient("مشتری صفحه دارد");
    const sent = await ask(client, salon.id);
    expect(sent.status).toBe(200);
    expect(sent.payload.data.services).toEqual(["پدیکور"]);
  });

  it("a single service with «و» in its name counts as having it", async () => {
    const salon = await salonWith("Contact Page Wax Salon", [["وکس و اپیلاسیون", "45 دقیقه"]]);
    const client = await newClient("مشتری وکس");
    const sent = await ask(client, salon.id, { service: "وکس و اپیلاسیون", serviceEmoji: "waxing" });
    expect(sent.status).toBe(200);
    expect(sent.payload.data.services).toEqual(["وکس و اپیلاسیون"]);
  });

  it("an id that is not a salon or artist is refused", async () => {
    const other = await newClient("یه مشتری دیگه");
    const client = await newClient("مشتری اشتباه");
    expect((await ask(client, other.id)).status).toBe(404);
    expect((await ask(client, 99999999)).status).toBe(404);
  });
});

