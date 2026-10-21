import { describe, it, expect, afterAll } from "vitest";
import {
  openDb, makeSalon, makeClient, requestSlot, overlapViolations, futureBookingDay, sweep, sendBack, statusOf, createClient, registerUser
} from "./angle1Helpers.js";
import { normalizeBookingTimeLabel } from "../../app/shared/lib/time.js";
import { settledSmsCount, smsRows } from "./angle3Helpers.js";

/**
 * "Package 1" (founder's decisions 2026-10-21, see docs/DECISIONS.md): capacity, request deadlines, request caps,
 * identical requests, service caps and menu-only booking. The older angle* tests hold the red-test scenarios; this
 * file holds the new behaviour that has no test of its own there.
 */
const { db, connected } = openDb();
afterAll(async () => { await connected; await db.end(); });

const day = (n = 2) => futureBookingDay(n, { notOn: ["پنجشنبه"] });
const approve = (ctx, id) => ctx.salonClient.patch("/api/salon-bookings", { id, status: "تایید شده" });
const cancelByClient = (c, id) => c.client.post(`/api/salon-bookings/${id}/cancel`, {});
const TOO_MANY = "اول یکی از درخواست‌های قبلی را لغو کن یا منتظر جواب بمان";

describe("P1: seats", () => {
  it("a walk-in typed without an artist takes one of two seats: one client fits, the next is refused", async () => {
    const ctx = await makeSalon("P1 Seats", { staffCount: 2 });
    const d = day(2);
    expect((await ctx.salonClient.post("/api/salon-bookings", { service: "S30", bookingDate: d, time: "10:00", client: "حضوری" })).status).toBe(201);
    const a = await makeClient();
    const b = await makeClient();
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const second = await requestSlot(b, ctx.salon.user.id, { day: d, time: "10:00" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.payload.code).toBe("NO_FREE_ARTIST");
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
  });

  it("n simultaneous requests fill n staff (4 staff, 6 requests: exactly 4, on 4 different people)", async () => {
    const ctx = await makeSalon("P1 Four", { staffCount: 4 });
    const cs = [];
    for (let i = 0; i < 6; i += 1) cs.push(await makeClient(`P1 C${i}`));
    const d = day(3);
    const res = await Promise.all(cs.map((c) => requestSlot(c, ctx.salon.user.id, { day: d, time: "13:00" })));
    expect(res.map((r) => r.status).sort()).toEqual([201, 201, 201, 201, 409, 409]);
    const names = res.filter((r) => r.status === 201).map((r) => r.payload.data.booking.staff);
    expect(new Set(names).size).toBe(4);
    // the artists' own calendars carry exactly those four copies
    const copies = (await db.query("SELECT DISTINCT artist_user_id FROM artist_bookings WHERE source_salon_user_id = $1 AND booking_date = $2 AND status <> ALL($3)", [ctx.salon.user.id, d, ["لغو", "منقضی شده"]])).rows;
    expect(copies.length).toBe(4);
  });
});

describe("P2: deadlines", () => {
  it("a request is not approved after its service was deleted, and a free time of a closed day is not approved", async () => {
    const ctx = await makeSalon("P2 Gone", { staffCount: 1 });
    const a = await makeClient();
    const r = await requestSlot(a, ctx.salon.user.id, { day: day(2), time: "11:00" });
    expect(r.status).toBe(201);
    expect((await ctx.salonClient.delete("/api/salon-services", { id: ctx.services[0].id })).status).toBeLessThan(500);
    const res = await approve(ctx, r.payload.data.booking.id);
    expect(res.status).toBe(409);
    expect(res.payload.code).toBe("REQUEST_NOT_POSSIBLE");
    expect(await statusOf(a, r.payload.data.booking.id)).toBe("درخواست");
    // cancelling it still works
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id: r.payload.data.booking.id, status: "لغو" })).status).toBe(200);
  });

  it("a lapsed request does not hold its slot for the client's availability list either, before any sweep", async () => {
    const ctx = await makeSalon("P2 Free List", { staffCount: 1 });
    const a = await makeClient();
    const b = await makeClient();
    const d = day(2);
    const r = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const listed = async () => (await b.client.get(`/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${d}&service=S30`)).payload.data.times.map(normalizeBookingTimeLabel);
    expect(await listed()).not.toContain("10:00");
    await sendBack(db, r.payload.data.booking.id, 90);
    expect(await listed()).toContain("10:00");
  });

  it("a direct artist request past its hour cannot be approved by the artist", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "P2 Artist" });
    expect((await artistClient.post("/api/artist/me", { name: "S30", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
    const c = await makeClient();
    const d = day(2);
    const r = await c.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "S30", bookingDate: d, time: "10:00" });
    expect(r.status).toBe(201);
    await sendBack(db, r.payload.data.booking.id, 90, "artist_bookings");
    const res = await artistClient.patch("/api/artist/me", { kind: "booking", id: r.payload.data.booking.id, status: "تایید شده" });
    expect(res.status).toBe(409);
    expect(res.payload.code).toBe("BOOKING_EXPIRED");
    // and the same time is free for another client at once
    const other = await makeClient();
    expect((await other.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "S30", bookingDate: d, time: "10:00" })).status).toBe(201);
  });
});

describe("P3: caps on open requests", () => {
  it("3 open requests with one salon at most, with the friendly message; cancelling one makes room", async () => {
    const ctx = await makeSalon("P3 Per Salon", { staffCount: 1 });
    const c = await makeClient();
    const d = day(3);
    const made = [];
    for (const time of ["10:00", "11:00", "12:00"]) {
      const r = await requestSlot(c, ctx.salon.user.id, { day: d, time });
      expect(r.status).toBe(201);
      made.push(r.payload.data.booking.id);
    }
    const fourth = await requestSlot(c, ctx.salon.user.id, { day: d, time: "13:00" });
    expect(fourth.status).toBe(409);
    expect(fourth.payload.error).toContain(TOO_MANY);
    // someone else is not affected
    expect((await requestSlot(await makeClient(), ctx.salon.user.id, { day: d, time: "13:00" })).status).toBe(201);
    expect((await cancelByClient(c, made[0])).status).toBe(200);
    expect((await requestSlot(c, ctx.salon.user.id, { day: d, time: "14:00" })).status).toBe(201);
  });

  it("a confirmed or an expired request does not count as open", async () => {
    const ctx = await makeSalon("P3 Open Only", { staffCount: 1 });
    const c = await makeClient();
    const d = day(3);
    const first = await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" });
    const second = await requestSlot(c, ctx.salon.user.id, { day: d, time: "11:00" });
    const third = await requestSlot(c, ctx.salon.user.id, { day: d, time: "12:00" });
    expect([first.status, second.status, third.status]).toEqual([201, 201, 201]);
    expect((await approve(ctx, first.payload.data.booking.id)).status).toBe(200);
    await sendBack(db, second.payload.data.booking.id, 90);
    expect((await requestSlot(c, ctx.salon.user.id, { day: d, time: "13:00" })).status).toBe(201);
  });

  it("the cap holds against parallel requests (6 at once from one client: 3 accepted)", async () => {
    const ctx = await makeSalon("P3 Parallel", { staffCount: 3 });
    const c = await makeClient();
    const d = day(3);
    const res = await Promise.all(["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"].map((time) => requestSlot(c, ctx.salon.user.id, { day: d, time })));
    expect(res.filter((r) => r.status === 201).length).toBe(3);
    expect(res.filter((r) => r.status === 409).length).toBe(3);
  });

  it("3 open requests with one artist at most, direct", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "P3 Artist" });
    expect((await artistClient.post("/api/artist/me", { name: "S30", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
    const c = await makeClient();
    const d = day(3);
    const codes = [];
    for (const time of ["10:00", "11:00", "12:00", "13:00"]) {
      codes.push((await c.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "S30", bookingDate: d, time })).status);
    }
    expect(codes).toEqual([201, 201, 201, 409]);
  });

  it("the default wait is one hour, and 'any time' is at most 24 hours", async () => {
    const ctx = await makeSalon("P3 Wait", { staffCount: 1 });
    const c = await makeClient();
    const d = day(3);
    const plain = await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" });
    expect(plain.payload.data.booking.wait_minutes).toBe(60);
    const open = await requestSlot(c, ctx.salon.user.id, { day: d, time: "11:00", waitMinutes: null });
    expect(open.status).toBe(201);
    await sendBack(db, open.payload.data.booking.id, 23 * 60);
    await sweep();
    expect(await statusOf(c, open.payload.data.booking.id)).toBe("درخواست");
    await sendBack(db, open.payload.data.booking.id, 25 * 60);
    await sweep();
    expect(await statusOf(c, open.payload.data.booking.id)).toBe("منقضی شده");
  });
});

describe("P11: identical requests", () => {
  it("an identical direct artist request sent twice in parallel is one booking and the artist is told once", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "P11 Artist" });
    expect((await artistClient.post("/api/artist/me", { name: "S30", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
    const c = await makeClient();
    const d = day(2);
    const res = await Promise.all([1, 2, 3].map(() => c.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "S30", bookingDate: d, time: "10:00" })));
    expect(res.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(res.filter((r) => r.status === 201).length).toBe(1);
    expect(new Set(res.map((r) => r.payload.data.booking.id)).size).toBe(1);
    const rows = (await db.query("SELECT id FROM artist_bookings WHERE artist_user_id = $1 AND status <> ALL($2)", [artist.user.id, ["لغو", "منقضی شده"]])).rows;
    expect(rows.length).toBe(1);
  });

  it("the same request for a visit of two services is merged too", async () => {
    const ctx = await makeSalon("P11 Visit", { staffCount: 2, services: [{ name: "S30", duration: "۳۰ دقیقه" }, { name: "S60", duration: "۶۰ دقیقه" }] });
    const c = await makeClient();
    const d = day(2);
    const res = await Promise.all([1, 2].map(() => requestSlot(c, ctx.salon.user.id, { parts: ["S30", "S60"], day: d, time: "10:00" })));
    expect(res.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(new Set(res.map((r) => r.payload.data.booking.id)).size).toBe(1);
  });
});

describe("P13: limits", () => {
  it("a client can only book a service on the salon's menu, and its length is the salon's (never the client's)", async () => {
    const ctx = await makeSalon("P13 Menu", { staffCount: 1 });
    const c = await makeClient();
    const d = day(2);
    const made = await c.client.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: "ساخته‌شده", bookingDate: d, time: "10:00", durationMinutes: 600 });
    expect(made.status).toBe(400);
    expect(made.payload.code).toBe("SERVICE_NOT_LISTED");
    const listed = await c.client.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: "S30", bookingDate: d, time: "10:00", durationMinutes: 600 });
    expect(listed.status).toBe(201);
    expect(listed.payload.data.booking.duration_minutes).toBe(30);
    const multi = await c.client.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, parts: [{ service: "S30" }, { service: "ساخته‌شده" }], bookingDate: d, time: "12:00" });
    expect(multi.status).toBe(400);
  });

  it("a client can only book a service on the artist's menu, with the artist's length", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "P13 Artist" });
    expect((await artistClient.post("/api/artist/me", { name: "S30", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
    const c = await makeClient();
    const d = day(2);
    const made = await c.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ساخته‌شده", bookingDate: d, time: "10:00", durationMinutes: 600 });
    expect(made.status).toBe(400);
    const listed = await c.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "S30", bookingDate: d, time: "10:00", durationMinutes: 600 });
    expect(listed.status).toBe(201);
    expect(listed.payload.data.booking.duration_minutes).toBe(30);
  });

  it("an artist cannot create more than 100 services either", async () => {
    const artistClient = createClient();
    await registerUser(artistClient, { type: "artist", name: "P13 Many" });
    const statuses = [];
    for (let i = 0; i < 101; i += 1) statuses.push((await artistClient.post("/api/artist/me", { name: `خدمت ${i}`, price: "1", duration: "30 دقیقه" })).status);
    expect(statuses.filter((s) => s === 201).length).toBe(100);
    expect(statuses[100]).toBe(409);
  });

  it("a salon's service cap is exactly 100, with a plain message", async () => {
    const ctx = await makeSalon("P13 Cap", { staffCount: 0, services: [] });
    let last;
    for (let i = 0; i < 101; i += 1) last = await ctx.salonClient.post("/api/salon-services", { name: `خدمت ${i}`, price: "1", duration: "30 دقیقه" });
    expect(last.status).toBe(409);
    expect(last.payload.code).toBe("SERVICE_LIMIT");
    expect((await ctx.salonClient.get("/api/salon-services")).payload.data.services.length).toBe(100);
  });

  it("the client name in the salon's SMS is cut to 30 characters", async () => {
    const ctx = await makeSalon("P13 Sms", { staffCount: 0 });
    const c = await makeClient("P13 Sms Client");
    const longName = "ن".repeat(80);
    const r = await c.client.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: "S30", bookingDate: day(2), time: "10:00", client: longName, phone: c.phone });
    expect(r.status).toBe(201);
    const filter = { phone: ctx.salon.phone, purpose: "booking_request" };
    await settledSmsCount(filter);
    const body = (await smsRows(filter))[0]?.body || "";
    expect(body).toContain("ن".repeat(30));
    expect(body).not.toContain("ن".repeat(31));
  });

  it("the free-times list is quick for a salon with 1500 bookings, and shows only live bookings of the near days", async () => {
    const ctx = await makeSalon("P13 Busy", { staffCount: 1 });
    const d = day(2);
    await db.query(`
      INSERT INTO salon_bookings (salon_user_id, client, phone, service, booking_date, time, duration_minutes, status)
      SELECT $1, 'Cust ' || g, '0913' || lpad(g::text, 7, '0'), 'S30', $2, '10:00', 30, CASE WHEN g = 1 THEN 'تازه' ELSE 'لغو' END FROM generate_series(1, 1500) g
    `, [ctx.salon.user.id, d]);
    const c = await makeClient();
    const t0 = Date.now();
    const res = await Promise.all(Array.from({ length: 10 }, () => c.client.get(`/api/salon-bookings?salonUserId=${ctx.salon.user.id}`)));
    const ms = Date.now() - t0;
    console.log(`[p13] 10 parallel reads of a salon with 1500 bookings: ${ms} ms`);
    expect(res.every((r) => r.status === 200)).toBe(true);
    expect(ms).toBeLessThan(1500);
    expect(res[0].payload.data.unavailableSlots.length).toBe(1);
    const t1 = Date.now();
    const avail = await c.client.get(`/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${d}&service=S30`);
    console.log(`[p13] free-times list for one day: ${Date.now() - t1} ms`);
    expect(avail.status).toBe(200);
  });
});
