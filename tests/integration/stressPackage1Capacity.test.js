import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  openDb, clearThrottles, makeSalon, makeClients, post, patch, call, tally, bad, latency, jitter, note, slotBody, futureBookingDay,
  peakConcurrent, calendarMismatches, overlapViolations, INACTIVE, pgLeftovers
} from "./stressPackage1Helpers.js";
import { smsRows } from "./angle3Helpers.js";

/**
 * Package 1 under load, part A: seats (capacity lock + staff pick), the same account sending the same thing many
 * times at once, and the caps on open requests. Every request is a real HTTP call to the running server.
 */
const { db, connected } = openDb();
beforeAll(async () => { await connected; });
afterAll(async () => { await db.end(); });

const day = (n = 2) => futureBookingDay(n, { notOn: ["پنجشنبه"] });
const SERVICES = [{ name: "S30", duration: "۳۰ دقیقه" }, { name: "S60", duration: "۶۰ دقیقه" }];
let pool = [];
const cancelAllOpen = () => db.query("UPDATE salon_bookings SET status = 'لغو' WHERE client_user_id = ANY($1) AND status = 'درخواست'", [pool.map((c) => Number(c.user.id))]);

describe("1) seats under load", () => {
  beforeAll(async () => { pool = await makeClients(60, "P1 Seat"); }, 240_000);

  for (const staffCount of [1, 2, 3, 4]) {
    it(`${staffCount} staff: 40 clients ask for the very same slot at once -> exactly ${staffCount} accepted, on different people`, async () => {
      await cancelAllOpen();
      await clearThrottles(db);
      const ctx = await makeSalon(`P1 Same ${staffCount}`, { staffCount, services: SERVICES });
      const d = day(2);
      const results = await Promise.all(pool.slice(0, 40).map((c) => post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "10:00" }))));
      note(`same slot, ${staffCount} staff`, tally(results), latency(results));
      expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
      const ok = results.filter((r) => r.status === 201);
      expect(ok.length).toBe(staffCount);
      expect(results.filter((r) => r.status === 409).every((r) => r.payload.code === "NO_FREE_ARTIST")).toBe(true);
      expect(new Set(ok.map((r) => r.payload.data.booking.staff)).size).toBe(staffCount);
      expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
      expect(await calendarMismatches(db, ctx.salon.user.id, d)).toEqual([]);
    }, 120_000);
  }

  for (const staffCount of [1, 2, 3, 4]) {
    for (const mode of ["burst", "jitter"]) {
      it(`${staffCount} staff, 60 clients on overlapping slots (${mode}): never more bookings than seats, nobody double-booked`, async () => {
        await cancelAllOpen();
        await clearThrottles(db);
        const ctx = await makeSalon(`P1 Overlap ${staffCount}${mode}`, { staffCount, services: SERVICES });
        const d = day(3);
        const times = ["10:00", "10:30", "11:00", "11:30", "12:00"];
        const results = await Promise.all(pool.slice(0, 60).map(async (c, i) => {
          if (mode === "jitter") await jitter(120);
          return post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: times[i % times.length], service: i % 3 === 0 ? "S60" : "S30" }));
        }));
        note(`overlap ${mode}, ${staffCount} staff`, tally(results), latency(results));
        expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
        expect(results.every((r) => [201, 409].includes(r.status)), JSON.stringify(tally(results))).toBe(true);
        expect(await peakConcurrent(db, ctx.salon.user.id, d)).toBeLessThanOrEqual(staffCount);
        expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
        expect(await calendarMismatches(db, ctx.salon.user.id, d)).toEqual([]);
        // every accepted request got a named artist
        const unnamed = (await db.query("SELECT id FROM salon_bookings WHERE salon_user_id = $1 AND booking_date = $2 AND status <> ALL($3) AND COALESCE(staff,'') = ''", [ctx.salon.user.id, d, INACTIVE])).rows;
        expect(unnamed.length).toBe(0);
      }, 120_000);
    }
  }

  for (const staffCount of [2, 3]) {
    it(`${staffCount} staff: walk-ins typed by the salon and an artist going on and off leave while 14 clients ask`, async () => {
      await cancelAllOpen();
      await clearThrottles(db);
      const ctx = await makeSalon(`P1 Mixed ${staffCount}`, { staffCount, services: SERVICES });
      const d = day(4);
      const times = ["10:00", "10:30", "11:00", "11:30"];
      const ops = [];
      pool.slice(0, 14).forEach((c, i) => ops.push((async () => { await jitter(60); return { kind: "client", ...(await post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: times[i % 4] }))) }; })()));
      for (let i = 0; i < 8; i += 1) {
        ops.push((async () => {
          await jitter(60);
          const named = i % 2 === 0 ? { staff: ctx.staff[i % staffCount].row.name || ctx.staff[i % staffCount].artist.user.name } : {};
          return { kind: "walkin", ...(await post(ctx.salonClient, "/api/salon-bookings", { service: "S30", bookingDate: d, time: times[i % 4], client: "حضوری", phone: "09120000009", ...named })) };
        })());
      }
      ops.push((async () => {
        const out = [];
        for (let i = 0; i < 6; i += 1) {
          await jitter(25);
          out.push(await patch(ctx.salonClient, "/api/salon-staff", { id: ctx.staff[0].row.id, state: i % 2 === 0 ? "مرخصی" : "فعال" }));
        }
        return { kind: "leave", status: out.every((r) => r.status < 500 && r.status > 0) ? 200 : 500 };
      })());
      const results = await Promise.all(ops);
      note(`mixed ${staffCount} staff`, JSON.stringify(results.reduce((a, r) => ({ ...a, [`${r.kind}:${r.status}`]: (a[`${r.kind}:${r.status}`] || 0) + 1 }), {})));
      expect(bad(results).map((r) => `${r.kind} ${r.error || r.status}`)).toEqual([]);
      expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
      expect(await calendarMismatches(db, ctx.salon.user.id, d)).toEqual([]);
      expect(await peakConcurrent(db, ctx.salon.user.id, d)).toBeLessThanOrEqual(staffCount);
    }, 120_000);
  }
});

describe("2) the same account submitting the same request many times at once", () => {
  for (const copies of [2, 3, 50]) {
    it(`${copies} identical parallel submits -> exactly one booking, one calendar copy, at most one SMS to the salon`, async () => {
      await clearThrottles(db);
      const [c] = await makeClients(1, "P1 Dup");
      const ctx = await makeSalon(`P1 Dup ${copies}`, { staffCount: 3, services: SERVICES });
      const d = day(2);
      const sentBefore = (await smsRows({ phone: ctx.salon.user.phone, purpose: "booking_request" })).length;
      // the 50-way case also exceeds the 20-a-minute throttle of one account, which is a 429 and not a booking
      const results = await Promise.all(Array.from({ length: copies }, () => post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "10:00" }))));
      note(`dup x${copies}`, tally(results), latency(results));
      expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
      expect(results.filter((r) => r.status === 201).length).toBe(1);
      expect(results.every((r) => [200, 201, 429].includes(r.status))).toBe(true);
      const ids = new Set(results.filter((r) => r.status < 300).map((r) => r.payload.data.booking.id));
      expect(ids.size).toBe(1);
      const rows = (await db.query("SELECT id FROM salon_bookings WHERE salon_user_id = $1 AND client_user_id = $2", [ctx.salon.user.id, c.user.id])).rows;
      expect(rows.length).toBe(1);
      expect((await db.query("SELECT id FROM artist_bookings WHERE source_salon_user_id = $1 AND status <> ALL($2)", [ctx.salon.user.id, ["لغو", "منقضی شده"]])).rows.length).toBe(1);
      await new Promise((r) => setTimeout(r, 1500));
      const sent = (await smsRows({ phone: ctx.salon.user.phone, purpose: "booking_request" })).length - sentBefore;
      expect(sent).toBeLessThanOrEqual(1);
    }, 120_000);
  }

  it("the same time written 6 different ways (10:00, ۱۰:۰۰, ١٠:٠٠, 10:00 with spaces ...) and the same day in Persian and Latin digits, 24 parallel -> still exactly one", async () => {
    await clearThrottles(db);
    const [c] = await makeClients(1, "P1 DupVariants");
    const ctx = await makeSalon("P1 Dup Variants", { staffCount: 3, services: SERVICES });
    const d = day(2);
    const persian = d.replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[x]);
    const arabic = d.replace(/\d/g, (x) => "٠١٢٣٤٥٦٧٨٩"[x]);
    const times = ["10:00", "۱۰:۰۰", "١٠:٠٠", " 10:00 ", "10:00:00", "10:0"];
    const days = [d, persian, arabic, d];
    const results = await Promise.all(Array.from({ length: 24 }, (_, i) => post(c.client, "/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: "S30", bookingDate: days[i % 4], time: times[i % 6] })));
    note("dup variants", tally(results), latency(results));
    expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
    expect(results.filter((r) => r.status === 201).length).toBe(1);
    expect((await db.query("SELECT id FROM salon_bookings WHERE salon_user_id = $1 AND client_user_id = $2 AND status <> ALL($3)", [ctx.salon.user.id, c.user.id, INACTIVE])).rows.length).toBe(1);
  }, 120_000);

  it("same account, same request through a different path (artist route) x 50 -> exactly one", async () => {
    await clearThrottles(db);
    const [c] = await makeClients(1, "P1 DupA");
    const { createClient, registerUser } = await import("./helpers.js");
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: `P1 Dup Artist ${Math.random().toString(36).slice(2, 7)}` });
    expect((await artistClient.post("/api/artist/me", { name: "ناخن", price: "100", duration: "60 دقیقه" })).ok).toBe(true);
    const d = day(2);
    const results = await Promise.all(Array.from({ length: 15 }, () => post(c.client, "/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: d, time: "10:00" })));
    note("artist dup x15", tally(results), latency(results));
    expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
    expect(results.filter((r) => r.status === 201).length).toBe(1);
    expect((await db.query("SELECT id FROM artist_bookings WHERE artist_user_id = $1 AND client_user_id = $2", [artist.user.id, c.user.id])).rows.length).toBe(1);
  }, 120_000);
});

describe("3) caps on open requests under parallel load", () => {
  const countOpen = async (clientId) => ({
    perSalon: (await db.query("SELECT salon_user_id, COUNT(*)::int n FROM salon_bookings WHERE client_user_id = $1 AND status = 'درخواست' GROUP BY 1", [clientId])).rows,
    perArtist: (await db.query("SELECT artist_user_id, COUNT(*)::int n FROM artist_bookings WHERE client_user_id = $1 AND status = 'تازه' AND source_salon_user_id IS NULL GROUP BY 1", [clientId])).rows
  });

  it("one client fires 30 different requests at ONE salon at once -> exactly 3 open", async () => {
    await clearThrottles(db);
    const [c] = await makeClients(1, "P1 Cap1");
    const ctx = await makeSalon("P1 Cap One", { staffCount: 6, services: SERVICES });
    const d = day(3);
    const days = [d, day(4)];
    const jobs = Array.from({ length: 30 }, (_, i) => ({ d: days[i % 2], time: `${String(10 + Math.floor(i / 4)).padStart(2, "0")}:${["00", "30"][Math.floor(i / 2) % 2]}` }));
    const results = await Promise.all(jobs.map((job) => post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: job.d, time: job.time }))));
    note("cap 1 salon", tally(results), latency(results));
    note("uncoded 409 messages", JSON.stringify([...new Set(results.filter((r) => r.status === 409 && !r.payload.code).map((r) => r.payload.error))]));
    expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
    const open = await countOpen(c.user.id);
    expect(open.perSalon.reduce((a, r) => a + r.n, 0)).toBeLessThanOrEqual(3);
    // 429 (the 20-a-minute throttle) or 409 (cap) are both a "no"; the created ones are exactly the open ones
    expect(results.filter((r) => r.status === 201).length).toBe(open.perSalon.reduce((a, r) => a + r.n, 0));
    expect(results.filter((r) => r.status === 409).every((r) => /TOO_MANY|NO_FREE/.test(r.payload.code || ""))).toBe(true);
  }, 120_000);

  it("one client fires 30 requests across 10 salons at once -> never over 3 per salon or 5 in total", async () => {
    await clearThrottles(db);
    const [c] = await makeClients(1, "P1 Cap10");
    const salons = [];
    for (let i = 0; i < 10; i += 1) salons.push(await makeSalon(`P1 Cap Ten ${i}`, { staffCount: 3, services: SERVICES }));
    const d = day(3);
    const jobs = [];
    for (let i = 0; i < 30; i += 1) jobs.push({ salon: salons[i % 10], time: ["10:00", "11:00", "12:00"][Math.floor(i / 10)] });
    const results = await Promise.all(jobs.map((job) => post(c.client, "/api/salon-bookings", slotBody(job.salon.salon.user.id, { day: d, time: job.time }))));
    note("cap 10 salons", tally(results), latency(results));
    expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
    const open = await countOpen(c.user.id);
    const total = open.perSalon.reduce((a, r) => a + r.n, 0) + open.perArtist.reduce((a, r) => a + r.n, 0);
    note("open per salon", JSON.stringify(open.perSalon.map((r) => r.n)), "total", total);
    expect(total).toBeLessThanOrEqual(5);
    expect(Math.max(0, ...open.perSalon.map((r) => r.n))).toBeLessThanOrEqual(3);
  }, 180_000);

  it("mixed salons and artists, 30 parallel -> total of both kinds stays at 5", async () => {
    await clearThrottles(db);
    const [c] = await makeClients(1, "P1 CapMix");
    const { createClient, registerUser } = await import("./helpers.js");
    const salons = [];
    for (let i = 0; i < 4; i += 1) salons.push(await makeSalon(`P1 Cap Mix ${i}`, { staffCount: 2, services: SERVICES }));
    const artists = [];
    for (let i = 0; i < 4; i += 1) {
      const ac = createClient();
      const a = await registerUser(ac, { type: "artist", name: `P1 Cap Mix Artist ${i} ${Math.random().toString(36).slice(2, 6)}` });
      await ac.post("/api/artist/me", { name: "ناخن", price: "100", duration: "60 دقیقه" });
      artists.push(a);
    }
    const d = day(3);
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 2
      ? post(c.client, "/api/salon-bookings", slotBody(salons[i % 4].salon.user.id, { day: d, time: ["10:00", "11:00", "12:00"][i % 3] }))
      : post(c.client, "/api/artist/bookings", { artistUserId: artists[i % 4].user.id, service: "ناخن", bookingDate: d, time: ["10:00", "11:00", "12:00", "13:00"][i % 4] }))));
    note("cap mixed", tally(results), latency(results));
    expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
    const open = await countOpen(c.user.id);
    const total = open.perSalon.reduce((a, r) => a + r.n, 0) + open.perArtist.reduce((a, r) => a + r.n, 0);
    expect(total).toBeLessThanOrEqual(5);
    expect(Math.max(0, ...open.perSalon.map((r) => r.n), ...open.perArtist.map((r) => r.n))).toBeLessThanOrEqual(3);
  }, 180_000);

  it("a different client at the same moment is not blocked by someone else's cap", async () => {
    await clearThrottles(db);
    const [a, b] = await makeClients(2, "P1 CapOther");
    const ctx = await makeSalon("P1 Cap Other", { staffCount: 6, services: SERVICES });
    const d = day(3);
    const fire = (c, times) => Promise.all(times.map((time) => post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time }))));
    const [ra, rb] = await Promise.all([fire(a, ["10:00", "11:00", "12:00", "13:00", "14:00"]), fire(b, ["10:00", "11:00", "12:00"])]);
    expect(ra.filter((r) => r.status === 201).length).toBe(3);
    expect(rb.filter((r) => r.status === 201).length).toBe(3);
  }, 60_000);

  it("at the end nothing is stuck in Postgres", async () => {
    await new Promise((r) => setTimeout(r, 1500));
    const left = await pgLeftovers(db);
    note("leftovers", JSON.stringify({ idleInTx: left.idleInTx.length, waiting: left.waiting.length, advisory: left.advisory.length, active: left.active.length }));
    expect(left.idleInTx).toEqual([]);
    expect(left.waiting).toEqual([]);
  });
});
