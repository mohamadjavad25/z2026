import { describe, it, expect, afterAll } from "vitest";
import {
  newSalon, newClient, newArtist, bookSalon, settledSmsCount, smsRows, hhmm, db, connected, futureBookingDay,
  createClient, ipHeaders, uniq
} from "./angle3Helpers.js";

afterAll(async () => { await connected; await db.end(); });

const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

describe("angle3a: slot hoarding", () => {
  it("one client cannot pin every hourly slot of a salon day with pending requests", async () => {
    const salon = await newSalon("Hoard Salon");
    const hoarder = await newClient("Hoarder");
    const day = futureBookingDay(2);
    const results = [];
    for (const h of HOURS) results.push((await bookSalon(hoarder, salon, { day, time: hhmm(h) })).status);
    const accepted = results.filter((s) => s === 201).length;
    console.log("[hoard] statuses", results.join(","), "accepted", accepted);
    // A sane product caps pending requests per client per salon (3-5) so one account cannot block the whole day.
    expect(accepted).toBeLessThanOrEqual(5);
  });

  it("a single request cannot block the whole day through a made-up service + durationMinutes", async () => {
    const salon = await newSalon("Longblock Salon");
    const attacker = await newClient("Longblock");
    const victim = await newClient("Victim");
    const day = futureBookingDay(2);
    const r = await bookSalon(attacker, salon, { day, time: hhmm(10), service: "ساخته‌شده", extra: { durationMinutes: 600 } });
    console.log("[longblock] made-up service 600min ->", r.status, r.payload?.data?.booking?.duration_minutes);
    const v = await bookSalon(victim, salon, { day, time: hhmm(16) });
    console.log("[longblock] victim at 16:00 ->", v.status);
    // Either the made-up service is refused, or its length is clamped so a normal client can still book later that day.
    expect(v.status).toBe(201);
  });

  it("a client cannot hold the same slot at many salons at once (global cap on pending requests)", async () => {
    const salons = [];
    for (let i = 0; i < 6; i += 1) salons.push(await newSalon(`Multi ${i}`));
    const hoarder = await newClient("Multi Hoarder");
    const day = futureBookingDay(2);
    let accepted = 0;
    for (const s of salons) if ((await bookSalon(hoarder, s, { day, time: hhmm(11) })).status === 201) accepted += 1;
    console.log("[multi-salon] same slot accepted at", accepted, "of", salons.length, "salons");
    // [design] the product may want to let a client ask 2-3 places for the same hour, but not unlimited.
    expect(accepted).toBeLessThanOrEqual(3);
  });

  it("the per-client booking rate limit exists (20/min) but is per account, so throwaway accounts multiply it", async () => {
    const salon = await newSalon("Rate Salon");
    const a = await newClient("Rate A");
    const day = futureBookingDay(2);
    const statuses = [];
    for (let i = 0; i < 25; i += 1) {
      statuses.push((await bookSalon(a, salon, { day: futureBookingDay(2 + (i % 5)), time: hhmm(10 + (i % 10)) })).status);
    }
    console.log("[rate] statuses", statuses.join(","));
    expect(statuses).toContain(429);
    // Five throwaway accounts (each a fresh client): together they fill a whole day in one go.
    const day2 = futureBookingDay(9);
    const throwaways = [];
    for (let i = 0; i < 5; i += 1) throwaways.push(await newClient(`Throw ${i}`));
    let filled = 0;
    for (let i = 0; i < HOURS.length; i += 1) {
      if ((await bookSalon(throwaways[i % 5], salon, { day: day2, time: hhmm(HOURS[i]) })).status === 201) filled += 1;
    }
    console.log("[throwaway] slots filled by 5 throwaway accounts:", filled);
    const real = await newClient("Real customer");
    const realTry = await bookSalon(real, salon, { day: day2, time: hhmm(14) });
    console.log("[throwaway] real customer afterwards ->", realTry.status);
    // This is expected to be possible today (no phone-verification gate in the test env); we record what a salon must do to recover.
    const list = await salon.client.get("/api/salon-bookings");
    const pending = list.payload.data.bookings.filter((b) => b.booking_date === day2 && b.status === "درخواست");
    console.log("[throwaway] pending requests the salon must cancel one by one:", pending.length);
    const t0 = Date.now();
    for (const b of pending) await salon.client.patch("/api/salon-bookings", { id: b.id, status: "لغو" });
    console.log("[throwaway] recovery took ms:", Date.now() - t0, "(no bulk cancel / block-client endpoint exists)");
    const after = await bookSalon(real, salon, { day: day2, time: hhmm(14) });
    expect(after.status).toBe(201);
    // cost of recovery: every cancel texted the attacker's phone with a paid SMS
    const answers = await settledSmsCount({ purpose: "booking_answer" });
    console.log("[throwaway] booking_answer SMS in whole log so far:", answers);
  });
});

describe("angle3a: SMS / push cost storm", () => {
  it("one client cannot make the salon receive an SMS for every request (per client+salon SMS cap)", async () => {
    const salon = await newSalon("SmsStorm Salon");
    const client = await newClient("SmsStorm");
    const before = (await smsRows({ phone: salon.phone, purpose: "booking_request" })).length;
    let accepted = 0;
    for (let i = 0; i < 15; i += 1) {
      const r = await bookSalon(client, salon, { day: futureBookingDay(2 + Math.floor(i / 10)), time: hhmm(10 + (i % 10)) });
      if (r.status === 201) accepted += 1;
    }
    const sent = (await settledSmsCount({ phone: salon.phone, purpose: "booking_request" })) - before;
    console.log("[sms-storm] accepted", accepted, "requests -> SMS to the salon:", sent);
    expect(sent).toBeLessThanOrEqual(3);
  });

  it("request -> cancel -> request loop on one slot does not text the salon each round", async () => {
    const salon = await newSalon("Loop Salon");
    const client = await newClient("Looper");
    const day = futureBookingDay(2);
    let rounds = 0;
    for (let i = 0; i < 12; i += 1) {
      const r = await bookSalon(client, salon, { day, time: hhmm(12) });
      if (r.status !== 201) break;
      rounds += 1;
      const c = await client.client.post(`/api/salon-bookings/${r.payload.data.booking.id}/cancel`, {});
      if (c.status !== 200) break;
    }
    const sent = await settledSmsCount({ phone: salon.phone, purpose: "booking_request" });
    console.log("[loop] rounds", rounds, "SMS to salon", sent);
    expect(sent).toBeLessThanOrEqual(3);
  });

  it("answering a request twice does not text the client twice; cancelling an already cancelled one sends nothing", async () => {
    const salon = await newSalon("Idem Salon");
    const client = await newClient("Idem", { verified: false });
    const day = futureBookingDay(2);
    const r = await bookSalon(client, salon, { day, time: hhmm(10) });
    expect(r.status).toBe(201);
    const id = r.payload.data.booking.id;
    const base = (await smsRows({ phone: client.phone, purpose: "booking_answer" })).length;
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await salon.client.patch("/api/salon-bookings", { id, status: "تایید شده" })).status);
    const afterApprove = (await settledSmsCount({ phone: client.phone, purpose: "booking_answer" })) - base;
    console.log("[idem] approve x5 statuses", statuses.join(","), "SMS", afterApprove);
    const cancels = [];
    for (let i = 0; i < 5; i += 1) cancels.push((await salon.client.patch("/api/salon-bookings", { id, status: "لغو" })).status);
    const afterCancel = (await settledSmsCount({ phone: client.phone, purpose: "booking_answer" })) - base;
    console.log("[idem] cancel x5 statuses", cancels.join(","), "total SMS", afterCancel);
    expect(afterApprove).toBe(1);
    expect(afterCancel).toBe(2);
  });

  it("a salon answering many times is throttled (no unbounded SMS to one customer)", async () => {
    const salon = await newSalon("Flood Salon");
    const client = await newClient("Flooded");
    const r = await bookSalon(client, salon, { day: futureBookingDay(2), time: hhmm(10) });
    const id = r.payload.data.booking.id;
    let ok = 0;
    for (let i = 0; i < 40; i += 1) if ((await salon.client.patch("/api/salon-bookings", { id, status: "تایید شده" })).status === 200) ok += 1;
    const sent = await settledSmsCount({ phone: client.phone, purpose: "booking_answer" });
    console.log("[flood] 40 approve calls ->", ok, "ok, SMS to the customer:", sent);
    expect(sent).toBeLessThanOrEqual(2);
  });

  it("artist: answering a direct request repeatedly does not text the client every time", async () => {
    const artist = await newArtist("Idem Artist");
    const client = await newClient("Artist Idem");
    const day = futureBookingDay(2);
    const r = await client.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: day, time: hhmm(11) });
    expect(r.status).toBe(201);
    const id = r.payload.data.booking.id;
    const sts = [];
    for (let i = 0; i < 5; i += 1) sts.push((await artist.client.patch("/api/artist/me", { kind: "booking", id, status: "تایید شده" })).status);
    for (let i = 0; i < 5; i += 1) sts.push((await artist.client.patch("/api/artist/me", { kind: "booking", id, status: "لغو" })).status);
    const sent = await settledSmsCount({ phone: client.phone, purpose: "booking_answer" });
    console.log("[artist-idem] statuses", sts.join(","), "SMS", sent);
    expect(sent).toBeLessThanOrEqual(2);
  });
});

describe("angle3a: anonymous artist bookings", () => {
  it("an anonymous caller (no session) cannot put requests in an artist's calendar", async () => {
    const artist = await newArtist("Anon Artist");
    const anon = createClient();
    const r = await anon.post("/api/artist/bookings", {
      artistUserId: artist.user.id, service: "ناخن", bookingDate: futureBookingDay(2), time: hhmm(10), clientName: "Bot", clientPhone: "09120001111"
    });
    console.log("[anon] status", r.status, JSON.stringify(r.payload).slice(0, 160));
    expect(r.status).toBe(401);
  });

  it("an anonymous flood cannot lock real clients out of booking an artist (throttle is keyed on the artist)", async () => {
    const artist = await newArtist("Throttled Artist");
    const anon = createClient();
    const day = futureBookingDay(2);
    let accepted = 0; let limited = 0;
    for (let i = 0; i < 22; i += 1) {
      const r = await anon.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: day, time: hhmm(10 + (i % 10)), clientName: `Bot ${i}`, clientPhone: "09120002222" });
      if (r.status === 201) accepted += 1; if (r.status === 429) limited += 1;
    }
    const real = await newClient("Real For Artist");
    const realTry = await real.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: futureBookingDay(3), time: hhmm(15) });
    console.log("[anon-dos] anonymous accepted", accepted, "limited", limited, "real client ->", realTry.status);
    expect(realTry.status).toBe(201);
  });

  it("an anonymous booking typed with a victim's verified phone does not appear in the victim's own booking list", async () => {
    const artist = await newArtist("Phone Artist");
    const victim = await newClient("Victim Verified", { verified: true });
    const anon = createClient();
    const r = await anon.post("/api/artist/bookings", {
      artistUserId: artist.user.id, service: "ناخن", bookingDate: futureBookingDay(2), time: hhmm(10), clientName: "Someone", clientPhone: victim.phone
    });
    console.log("[anon-phone] create ->", r.status);
    const mine = await victim.client.get("/api/client-bookings");
    const seen = (mine.payload?.data?.artistBookings || []).length;
    console.log("[anon-phone] victim sees", seen, "artist bookings they never made");
    expect(seen).toBe(0);
  });

  it("a signed-in client cannot attach someone else's name/phone to a request (salon sees the real account's data)", async () => {
    const salon = await newSalon("Spoof Salon");
    const attacker = await newClient("Spoofer");
    const r = await bookSalon(attacker, salon, { day: futureBookingDay(2), time: hhmm(10), extra: { phone: "09121234567", client: "Fake Name" } });
    expect(r.status).toBe(201);
    console.log("[spoof] stored phone", r.payload.data.booking.phone, "name", r.payload.data.booking.client, "(own phone", attacker.phone, ")");
    expect(r.payload.data.booking.phone).toBe(attacker.phone);
  });
});
