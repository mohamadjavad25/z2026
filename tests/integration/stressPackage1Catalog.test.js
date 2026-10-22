import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  openDb, clearThrottles, makeSalon, makeClients, get, post, patch, call, tally, bad, latency, percentile, note, slotBody, futureBookingDay, sleep, jitter,
  createClient, registerUser, seedHistory
} from "./stressPackage1Helpers.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

/**
 * Package 1 under load, part C: the 100-service cap, booking only what is on the menu while the menu changes, and the
 * client's availability reads with a salon that has a lot of history (the 60-day cached list).
 */
const { db, connected } = openDb();
beforeAll(async () => { await connected; });
afterAll(async () => { await db.end(); });

const day = (n = 2) => futureBookingDay(n, { notOn: ["پنجشنبه"] });
const SERVICES = [{ name: "S30", duration: "۳۰ دقیقه" }, { name: "S60", duration: "۶۰ دقیقه" }];
const ascii = (t) => String(t).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));

describe("5a) the 100-service cap", () => {
  it("salon at 85 services, 30 parallel creates -> exactly 15 succeed, 100 in total, the rest get SERVICE_LIMIT", async () => {
    const ctx = await makeSalon("P1 Cap Services", { services: [] });
    await db.query(
      "INSERT INTO salon_services (salon_user_id, name, price, duration) SELECT $1, 'pre ' || g, '100', '30 دقیقه' FROM generate_series(1, 85) g",
      [ctx.salon.user.id]
    );
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => post(ctx.salonClient, "/api/salon-services", { name: `new ${i}`, price: "100", duration: "30 دقیقه" })));
    note("salon services cap", tally(results), latency(results));
    expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
    expect(results.filter((r) => r.status === 201).length).toBe(15);
    expect(results.filter((r) => r.status === 409).every((r) => r.payload.code === "SERVICE_LIMIT")).toBe(true);
    expect((await db.query("SELECT COUNT(*)::int n FROM salon_services WHERE salon_user_id = $1", [ctx.salon.user.id])).rows[0].n).toBe(100);
    // 100 and still hammered: nothing more, and deleting one then creating many leaves room for exactly one
    const more = await Promise.all(Array.from({ length: 20 }, () => post(ctx.salonClient, "/api/salon-services", { name: "extra", price: "100", duration: "30 دقیقه" })));
    expect(more.every((r) => r.status === 409)).toBe(true);
    const first = (await db.query("SELECT id FROM salon_services WHERE salon_user_id = $1 ORDER BY id LIMIT 1", [ctx.salon.user.id])).rows[0].id;
    const mixed = await Promise.all([
      call(ctx.salonClient, "DELETE", "/api/salon-services", { id: first }),
      ...Array.from({ length: 10 }, () => post(ctx.salonClient, "/api/salon-services", { name: "after delete", price: "100", duration: "30 دقیقه" }))
    ]);
    expect(bad(mixed).map((r) => r.error || r.status)).toEqual([]);
    const n = (await db.query("SELECT COUNT(*)::int n FROM salon_services WHERE salon_user_id = $1", [ctx.salon.user.id])).rows[0].n;
    expect(n).toBeLessThanOrEqual(100);
    expect(n).toBeGreaterThanOrEqual(99);
  }, 120_000);

  it("a salon starting empty, 130 parallel creates -> exactly 100", async () => {
    const ctx = await makeSalon("P1 Cap Services Zero", { services: [] });
    const results = await Promise.all(Array.from({ length: 130 }, (_, i) => post(ctx.salonClient, "/api/salon-services", { name: `s ${i}`, price: "100", duration: "30 دقیقه" })));
    note("salon services 130 from empty", tally(results), latency(results));
    expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
    expect(results.filter((r) => r.status === 201).length).toBe(100);
    expect((await db.query("SELECT COUNT(*)::int n FROM salon_services WHERE salon_user_id = $1", [ctx.salon.user.id])).rows[0].n).toBe(100);
  }, 120_000);

  it("artist at 90 services, 30 parallel creates -> exactly 10 succeed", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: `P1 CapArtist ${Math.random().toString(36).slice(2, 7)}` });
    await db.query("INSERT INTO artist_services (user_id, name, price, duration) SELECT $1, 'pre ' || g, '100', '30 دقیقه' FROM generate_series(1, 90) g", [artist.user.id]);
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => post(artistClient, "/api/artist/me", { name: `new ${i}`, price: "100", duration: "30 دقیقه" })));
    note("artist services cap", tally(results), latency(results));
    expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
    expect(results.filter((r) => r.status === 201).length).toBe(10);
    expect(results.filter((r) => r.status === 409).every((r) => r.payload.code === "SERVICE_LIMIT")).toBe(true);
    expect((await db.query("SELECT COUNT(*)::int n FROM artist_services WHERE user_id = $1", [artist.user.id])).rows[0].n).toBe(100);
  }, 120_000);
});

describe("5b) booking only what is on the menu while the menu changes", () => {
  it("5 rounds with the service deleted or renamed 20-200 ms into a burst: no 500, a request that got in cannot be approved later, requests that start after are refused", async () => {
    await clearThrottles(db);
    const names = ["V20", "V60", "V100", "V140", "V200"];
    const ctx = await makeSalon("P1 Menu Race", { staffCount: 4, services: [...SERVICES, ...names.map((n) => ({ name: n, duration: "۳۰ دقیقه" })), ...names.map((n) => ({ name: `R${n}`, duration: "۳۰ دقیقه" }))] });
    const clients = await makeClients(12, "P1 Menu");
    const d = day(3);
    const times = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"];
    const all = [];
    for (const [round, name] of names.entries()) {
      await db.query("UPDATE salon_bookings SET status = 'لغو' WHERE client_user_id = ANY($1) AND status = 'درخواست'", [clients.map((c) => Number(c.user.id))]);
      await clearThrottles(db);
      const delay = Number(name.slice(1));
      const vanish = ctx.services.find((s) => s.name === name);
      const rename = ctx.services.find((s) => s.name === `R${name}`);
      const out = await Promise.all([
        ...clients.slice(0, 8).map(async (c, i) => { await jitter(40); return { kind: "req", ...(await post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: times[i], service: i % 2 ? name : `R${name}` }))) }; }),
        (async () => { await sleep(delay); return { kind: "del", ...(await call(ctx.salonClient, "DELETE", "/api/salon-services", { id: vanish.id })) }; })(),
        (async () => { await sleep(delay); return { kind: "ren", ...(await patch(ctx.salonClient, "/api/salon-services", { id: rename.id, name: `X${name}`, price: "100", duration: "30 دقیقه" })) }; })()
      ]);
      expect(bad(out).map((r) => `${r.kind} ${r.error || r.status}`)).toEqual([]);
      const reqs = out.filter((r) => r.kind === "req");
      expect(reqs.every((r) => [201, 400, 409].includes(r.status))).toBe(true);
      expect(reqs.filter((r) => r.status === 400).every((r) => r.payload.code === "SERVICE_NOT_LISTED")).toBe(true);
      all.push(...reqs);
      // whatever got in for a service that is now gone cannot be approved
      for (const r of reqs.filter((x) => x.status === 201)) {
        const approve = await patch(ctx.salonClient, "/api/salon-bookings", { id: r.payload.data.booking.id, status: "تایید شده" });
        expect(approve.status, JSON.stringify(approve.payload)).toBe(409);
        expect(approve.payload.code).toBe("REQUEST_NOT_POSSIBLE");
      }
      // a request that starts after the change is refused
      const late = await post(clients[8].client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "15:00", service: name }));
      expect(late.status).toBe(400);
      expect(late.payload.code).toBe("SERVICE_NOT_LISTED");
      await db.query("UPDATE salon_bookings SET status = 'لغو' WHERE client_user_id = $1 AND status = 'درخواست'", [clients[8].user.id]);
    }
    note("menu change during bursts", tally(all));
    // the new name works
    expect((await post(clients[9].client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "16:00", service: "XV20" }))).status).toBe(201);
  }, 180_000);

  it("a service of 'someone else's menu' and a made-up one are refused in a parallel burst too", async () => {
    await clearThrottles(db);
    const a = await makeSalon("P1 Menu A", { staffCount: 2, services: [{ name: "ONLY A", duration: "۳۰ دقیقه" }] });
    const b = await makeSalon("P1 Menu B", { staffCount: 2, services: [{ name: "ONLY B", duration: "۳۰ دقیقه" }] });
    const clients = await makeClients(20, "P1 MenuX");
    const d = day(3);
    const results = await Promise.all(clients.map((c, i) => post(c.client, "/api/salon-bookings", slotBody(a.salon.user.id, { day: d, time: "10:00", service: i % 2 ? "ONLY B" : "نامعلوم" }))));
    expect(bad(results).map((r) => r.error || r.status)).toEqual([]);
    expect(results.every((r) => r.status === 400 && r.payload.code === "SERVICE_NOT_LISTED")).toBe(true);
    void b;
  }, 120_000);
});

describe("6) client availability reads with a salon that has a long history", () => {
  let ctx;
  let clients;
  const probeDay = () => day(6);
  const slotsOf = async (client) => (await get(client, `/api/salon-bookings?salonUserId=${ctx.salon.user.id}`)).payload.data.unavailableSlots;
  const hasSlot = (slots, dayKey, time) => slots.some((s) => s.booking_date === dayKey && ascii(s.time) === time);

  beforeAll(async () => {
    await clearThrottles(db);
    ctx = await makeSalon("P1 History Salon", { staffCount: 5, services: SERVICES });
    clients = await makeClients(24, "P1 Hist");
    await seedHistory(db, ctx, { skipDayKey: probeDay() });
    const total = (await db.query("SELECT COUNT(*)::int n FROM salon_bookings WHERE salon_user_id = $1", [ctx.salon.user.id])).rows[0].n;
    note("history salon bookings", total);
    expect(total).toBeGreaterThan(1500);
  }, 240_000);

  it("50 parallel reads of the unavailable-slots list and of the availability list stay fast (3 waves, cold cache first)", async () => {
    await clearThrottles(db);
    const busyDay = formatPersianDateKey(new Date(Date.now() + 3 * 86400000));
    for (let wave = 1; wave <= 3; wave += 1) {
      const slots = await Promise.all(Array.from({ length: 50 }, (_, i) => get(clients[i % clients.length].client, `/api/salon-bookings?salonUserId=${ctx.salon.user.id}`)));
      const avail = await Promise.all(Array.from({ length: 50 }, (_, i) => get(clients[i % clients.length].client, `/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${busyDay}&service=S30`)));
      const own = await Promise.all(Array.from({ length: 8 }, () => get(ctx.salonClient, "/api/salon-bookings")));
      for (const [name, r] of [["unavailable-slots", slots], ["availability", avail], ["salon's own list", own]]) {
        note(`wave ${wave} ${name} x${r.length}`, tally(r), latency(r));
        expect(bad(r).map((x) => x.error || x.status)).toEqual([]);
        expect(r.every((x) => x.status === 200)).toBe(true);
      }
      expect(percentile(slots.map((r) => r.ms), 95)).toBeLessThan(5000);
      expect(percentile(avail.map((r) => r.ms), 95)).toBeLessThan(10000);
    }
    const own = await get(ctx.salonClient, "/api/salon-bookings");
    note("salon's own list rows (listSalonBookings is capped at 1500)", own.payload.data.bookings.length);
    const first = await slotsOf(clients[0].client);
    note("unavailable-slots rows in the 60-day window", first.length);
  }, 180_000);

  for (const mode of ["quiet", "hammered"]) {
    it(`a booked slot is on the list the moment the booking returns (${mode} readers), a cancelled one is gone after the cache window`, async () => {
      await clearThrottles(db);
      const d = probeDay();
      const times = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"];
      let stop = false;
      const hammer = [];
      if (mode === "hammered") {
        for (let r = 0; r < 6; r += 1) hammer.push((async () => { let n = 0; while (!stop) { await get(clients[20 + (r % 4)].client, `/api/salon-bookings?salonUserId=${ctx.salon.user.id}`); n += 1; } return n; })());
      }
      // one booking at a time by a different client each, each followed at once by a probe read
      let freshMiss = 0;
      const made = [];
      for (let i = 0; i < times.length; i += 1) {
        const r = await post(clients[i].client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: times[i] }));
        expect(r.status, JSON.stringify(r.payload)).toBe(201);
        made.push({ id: r.payload.data.booking.id, time: times[i], client: clients[i] });
        const seen = await slotsOf(clients[(i + 1) % clients.length].client);
        if (!hasSlot(seen, d, times[i])) freshMiss += 1;
      }
      note(`fresh booking missing from the list right after it returned (${mode})`, freshMiss, "of", times.length);
      // and several bookings landing together, then one probe
      stop = true;
      const reads = await Promise.all(hammer);
      if (hammer.length) note("hammer reads", reads.reduce((a, b) => a + b, 0));
      expect(freshMiss).toBe(0);
      // cancel them all; right after, count how many are still shown (allowed for the 5 s window), then after the window none
      await Promise.all(made.map((m) => post(m.client.client, `/api/salon-bookings/${m.id}/cancel`, {})));
      const right = await slotsOf(clients[20].client);
      const stillShown = made.filter((m) => hasSlot(right, d, m.time)).length;
      note(`cancelled slots still shown right after cancel (${mode})`, stillShown, "of", made.length);
      await sleep(5600);
      const later = await slotsOf(clients[21].client);
      expect(made.filter((m) => hasSlot(later, d, m.time)).length).toBe(0);
    }, 120_000);
  }

  it("bookings landing in parallel with readers, with a probe after every return: no fresh booking is ever missing", async () => {
    await clearThrottles(db);
    const d = day(7);
    const times = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"];
    let stop = false;
    const hammer = Array.from({ length: 8 }, (_, r) => (async () => { while (!stop) await get(clients[12 + (r % 8)].client, `/api/salon-bookings?salonUserId=${ctx.salon.user.id}`); })());
    const outcomes = await Promise.all(times.map(async (time, i) => {
      await sleep(Math.floor(Math.random() * 40));
      const r = await post(clients[i].client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time }));
      if (r.status !== 201) return { time, status: r.status };
      const seen = await slotsOf(clients[(i + 5) % 12].client);
      return { time, status: 201, missing: !hasSlot(seen, d, time) };
    }));
    stop = true;
    await Promise.all(hammer);
    const created = outcomes.filter((o) => o.status === 201);
    note("parallel bookings + readers: created", created.length, "missing from list right after", created.filter((o) => o.missing).length);
    expect(created.length).toBeGreaterThan(0);
    expect(created.filter((o) => o.missing)).toEqual([]);
  }, 120_000);
});
