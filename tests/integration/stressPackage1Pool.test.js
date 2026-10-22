import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  openDb, clearThrottles, makeSalon, makeClients, get, post, patch, call, tally, bad, latency, percentile, note, slotBody, futureBookingDay, sweepNow,
  createClient, registerUser, healthy, pgLeftovers, seedHistory, pgLogSize, pgLogSince, sleep, calendarMismatches, overlapViolations, peakConcurrent, HANG_MS
} from "./stressPackage1Helpers.js";

/**
 * Package 1 under load, part E: the connection pool (10 connections per server) with 200 requests at once, across
 * heavy and light endpoints and on one hot salon day. Nothing may hang longer than 30 s, the server must stay alive,
 * and Postgres must be left with no open transaction, no waiting lock and no advisory lock.
 */
const { db, connected } = openDb();
const logOffset = pgLogSize();
beforeAll(async () => { await connected; });
afterAll(async () => { await db.end(); });

const day = (n = 3) => futureBookingDay(n, { notOn: ["پنجشنبه"] });
const SERVICES = [{ name: "S30", duration: "۳۰ دقیقه" }, { name: "S60", duration: "۶۰ دقیقه" }];

async function settle() {
  await sleep(1500);
  const left = await pgLeftovers(db);
  note("postgres after the burst", JSON.stringify({ idleInTx: left.idleInTx.length, waitingLocks: left.waiting.length, advisoryHeld: left.advisory.length, activeQueries: left.active.length }));
  return left;
}

describe("8) pool exhaustion", () => {
  let clients;
  beforeAll(async () => { clients = await makeClients(200, "P1 Pool", 8); }, 600_000);

  it("200 different clients ask for the same slot of a 4-artist salon at the same instant: 4 booked, 196 told no, nobody hangs, no 500", async () => {
    await clearThrottles(db);
    const ctx = await makeSalon("P1 Pool Hot", { staffCount: 4, services: SERVICES });
    const d = day(3);
    const results = await Promise.all(clients.map((c) => post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "10:00" }))));
    note("200 on one slot", tally(results), latency(results));
    expect(results.filter((r) => r.hung)).toEqual([]);
    const failures = results.filter((r) => r.status === 0 || r.status >= 500).map((r) => ({ s: r.status, e: r.error, p: r.payload }));
    expect(failures.slice(0, 3)).toEqual([]);
    expect(results.filter((r) => r.status === 201).length).toBe(4);
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
    expect(await calendarMismatches(db, ctx.salon.user.id, d)).toEqual([]);
    expect(await peakConcurrent(db, ctx.salon.user.id, d)).toBeLessThanOrEqual(4);
    expect(await healthy()).toBe(true);
    const left = await settle();
    expect(left.idleInTx).toEqual([]);
    expect(left.waiting).toEqual([]);
    expect(left.advisory).toEqual([]);
    await db.query("UPDATE salon_bookings SET status = 'لغو' WHERE salon_user_id = $1", [ctx.salon.user.id]);
  }, 180_000);

  it("200 different clients spread over 10 hot slots of 10 salons: no 500, nothing hangs", async () => {
    await clearThrottles(db);
    const salons = [];
    for (let i = 0; i < 10; i += 1) salons.push(await makeSalon(`P1 Pool Many ${i}`, { staffCount: 3, services: SERVICES }));
    const d = day(3);
    const times = ["10:00", "10:30", "11:00", "11:30", "12:00"];
    const results = await Promise.all(clients.map((c, i) => post(c.client, "/api/salon-bookings", slotBody(salons[i % 10].salon.user.id, { day: d, time: times[i % 5] }))));
    note("200 over 10 salons", tally(results), latency(results));
    expect(results.filter((r) => r.hung)).toEqual([]);
    expect(results.filter((r) => r.status === 0 || r.status >= 500).slice(0, 3)).toEqual([]);
    for (const s of salons) {
      expect(await overlapViolations(db, s.salon.user.id, d)).toEqual([]);
      expect(await peakConcurrent(db, s.salon.user.id, d)).toBeLessThanOrEqual(3);
    }
    await settle();
    await db.query("UPDATE salon_bookings SET status = 'لغو' WHERE client_user_id = ANY($1)", [clients.map((c) => Number(c.user.id))]);
  }, 240_000);

  it("200 mixed requests at once (booking, artist booking, cancel, service create, lists, availability on a salon with 1600 bookings, sweep, health)", async () => {
    await clearThrottles(db);
    const hist = await makeSalon("P1 Pool History", { staffCount: 5, services: SERVICES });
    await seedHistory(db, hist);
    const fresh = await makeSalon("P1 Pool Fresh", { staffCount: 3, services: SERVICES });
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: `P1 Pool Artist ${Math.random().toString(36).slice(2, 7)}` });
    await artistClient.post("/api/artist/me", { name: "ناخن", price: "100", duration: "60 دقیقه" });
    const d = day(3);
    const busyDay = (await db.query("SELECT booking_date FROM salon_bookings WHERE salon_user_id = $1 GROUP BY 1 ORDER BY 1 LIMIT 1 OFFSET 2", [hist.salon.user.id])).rows[0].booking_date;
    // a few requests to cancel and to approve
    const toCancel = [];
    for (let i = 0; i < 8; i += 1) {
      const r = await post(clients[150 + i].client, "/api/salon-bookings", slotBody(fresh.salon.user.id, { day: d, time: ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"][i] }));
      if (r.status === 201) toCancel.push({ id: r.payload.data.booking.id, c: clients[150 + i] });
    }
    const times = ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
    const jobs = [];
    for (let i = 0; i < 200; i += 1) {
      const c = clients[i % 150];
      switch (i % 10) {
        case 0: jobs.push(["book-salon", () => post(c.client, "/api/salon-bookings", slotBody(fresh.salon.user.id, { day: d, time: times[i % 6] }))]); break;
        case 1: jobs.push(["book-artist", () => post(c.client, "/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: d, time: times[i % 6] })]); break;
        case 2: jobs.push(["availability", () => get(c.client, `/api/salon-bookings/availability?salonUserId=${hist.salon.user.id}&day=${busyDay}&service=S30`)]); break;
        case 3: jobs.push(["unavailable-list", () => get(c.client, `/api/salon-bookings?salonUserId=${hist.salon.user.id}`)]); break;
        case 4: jobs.push(["salon-own-list", () => get(hist.salonClient, "/api/salon-bookings")]); break;
        case 5: jobs.push(["service-create", () => post(fresh.salonClient, "/api/salon-services", { name: `pool ${i}`, price: "100", duration: "30 دقیقه" })]); break;
        case 6: jobs.push(["client-list", () => get(c.client, "/api/salon-bookings")]); break;
        case 7: jobs.push(["sweep", () => sweepNow()]); break;
        case 8: jobs.push(["health", () => call(null, "GET", "/api/health")]); break;
        default: {
          const t = toCancel[i % Math.max(1, toCancel.length)];
          jobs.push(t ? ["cancel/approve", () => (i % 2 ? post(t.c.client, `/api/salon-bookings/${t.id}/cancel`, {}) : patch(fresh.salonClient, "/api/salon-bookings", { id: t.id, status: "تایید شده" }))] : ["noop", () => call(null, "GET", "/api/health")]);
        }
      }
    }
    const results = await Promise.all(jobs.map(async ([kind, fn]) => ({ kind, ...(await fn()) })));
    const byKind = {};
    for (const r of results) (byKind[r.kind] ||= []).push(r);
    for (const [kind, list] of Object.entries(byKind)) note(`mixed ${kind} x${list.length}`, tally(list.map((r) => ({ status: r.status, payload: {} }))), latency(list));
    note("mixed overall", tally(results), latency(results));
    expect(results.filter((r) => r.hung).map((r) => r.kind)).toEqual([]);
    const failures = results.filter((r) => r.status === 0 || r.status >= 500).map((r) => ({ k: r.kind, s: r.status, e: r.error, p: r.payload }));
    note("mixed failures", failures.length, JSON.stringify(failures.slice(0, 2)));
    expect(failures.slice(0, 3)).toEqual([]);
    expect(Math.max(...results.map((r) => r.ms))).toBeLessThan(HANG_MS);
    expect(await healthy()).toBe(true);
    const left = await settle();
    expect(left.idleInTx).toEqual([]);
    expect(left.waiting).toEqual([]);
    expect(left.advisory).toEqual([]);
  }, 300_000);

  it("200 at once on the availability list of a salon with 1600 bookings: all answered inside 30 s", async () => {
    await clearThrottles(db);
    const hist = await makeSalon("P1 Pool History 2", { staffCount: 5, services: SERVICES });
    await seedHistory(db, hist);
    const busyDay = (await db.query("SELECT booking_date FROM salon_bookings WHERE salon_user_id = $1 GROUP BY 1 ORDER BY 1 LIMIT 1 OFFSET 2", [hist.salon.user.id])).rows[0].booking_date;
    const results = await Promise.all(clients.map((c) => get(c.client, `/api/salon-bookings/availability?salonUserId=${hist.salon.user.id}&day=${busyDay}&service=S30`)));
    note("200 availability reads, 1600 bookings", tally(results), latency(results));
    expect(results.filter((r) => r.hung)).toEqual([]);
    expect(results.filter((r) => r.status === 0 || r.status >= 500).slice(0, 3).map((r) => ({ s: r.status, e: r.error, p: r.payload }))).toEqual([]);
    expect(await healthy()).toBe(true);
    await settle();
  }, 300_000);

  it("at the end: server alive, no stuck locks or open transactions, and Postgres never logged a deadlock", async () => {
    expect(await healthy()).toBe(true);
    const left = await settle();
    expect(left.idleInTx).toEqual([]);
    expect(left.waiting).toEqual([]);
    expect(left.advisory).toEqual([]);
    const log = pgLogSince(logOffset);
    const deadlocks = log.split("\n").filter((line) => /deadlock detected/i.test(line));
    note("postgres log: deadlocks", deadlocks.length, "log bytes", log.length);
    expect(deadlocks).toEqual([]);
  }, 60_000);
});
