import { describe, it, expect, afterAll } from "vitest";
import { normalizeBookingTimeLabel } from "../../app/shared/lib/time.js";
import {
  openDb, makeSalon, makeClient, requestSlot, overlapViolations, futureBookingDay, feasibleTimes, createClient, statusOf
} from "./angle1Helpers.js";

const { db, connected } = openDb();
afterAll(async () => { await connected; await db.end(); });

const norm = (list) => list.map(normalizeBookingTimeLabel);
const day = (n = 2) => futureBookingDay(n, { notOn: ["پنجشنبه"] }); // Thursday closes at 18:00

async function clients(n) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(await makeClient(`A1 Cap Client ${i}`));
  return out;
}

describe("capacity: N places, N+1 clients at the same moment", () => {
  it("2 staff, 3 simultaneous requests for one time: exactly 2 are taken, on two different people", async () => {
    const ctx = await makeSalon("A1 Two Staff", { staffCount: 2 });
    const cs = await clients(3);
    for (let round = 0; round < 3; round += 1) {
      const d = day(2 + round);
      const time = ["10:00", "12:00", "14:30"][round];
      const res = await Promise.all(cs.map((c) => requestSlot(c, ctx.salon.user.id, { day: d, time })));
      const codes = res.map((r) => r.status).sort();
      expect(res.every((r) => r.status < 500), `round ${round} 5xx: ${codes}`).toBe(true);
      expect(codes, `round ${round}: 2 staff must give 2 places, got ${codes}`).toEqual([201, 201, 409]);
      const staffNames = res.filter((r) => r.status === 201).map((r) => r.payload.data.booking.staff);
      expect(new Set(staffNames).size, `round ${round}: both places went to the same person ${staffNames}`).toBe(2);
      expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
    }
  });

  it("3 staff, 5 simultaneous requests: exactly 3 are taken", async () => {
    const ctx = await makeSalon("A1 Three Staff", { staffCount: 3 });
    const cs = await clients(5);
    const d = day(2);
    const res = await Promise.all(cs.map((c) => requestSlot(c, ctx.salon.user.id, { day: d, time: "11:00" })));
    const codes = res.map((r) => r.status).sort();
    expect(codes.every((c) => c < 500)).toBe(true);
    expect(codes, `got ${codes}`).toEqual([201, 201, 201, 409, 409]);
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
  });

  it("mixed durations that partly overlap: never double-booked and no refusal that was not needed", async () => {
    const ctx = await makeSalon("A1 Mixed", {
      staffCount: 2,
      services: [{ name: "S30", duration: "۳۰ دقیقه" }, { name: "S60", duration: "۶۰ دقیقه" }, { name: "S90", duration: "۹۰ دقیقه" }]
    });
    const cs = await clients(8);
    const d = day(3);
    const plan = [
      ["S60", "10:00"], ["S30", "10:30"], ["S90", "10:00"], ["S30", "11:00"],
      ["S60", "11:00"], ["S30", "10:00"], ["S90", "10:30"], ["S30", "11:30"]
    ];
    const res = await Promise.all(plan.map(([service, time], i) => requestSlot(cs[i], ctx.salon.user.id, { service, day: d, time })));
    const codes = res.map((r) => r.status);
    expect(codes.every((c) => c < 500), `5xx in ${codes}`).toBe(true);
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
    // A refused request that WOULD be accepted by the final state means the refusal was spurious (lost capacity).
    const spurious = [];
    for (let i = 0; i < plan.length; i += 1) {
      if (res[i].status !== 409) continue;
      const free = norm(await feasibleTimes(cs[i], ctx.salon.user.id, d, [plan[i][0]]));
      if (free.includes(plan[i][1])) spurious.push(plan[i].join("@"));
    }
    expect(spurious, `refused although still free afterwards: ${spurious}`).toEqual([]);
  });

  it("back-to-back (end == start) is fine, even at the same moment; one place only fits one", async () => {
    const ctx = await makeSalon("A1 Boundary", { staffCount: 1 });
    const cs = await clients(3);
    const d = day(2);
    const res = await Promise.all([
      requestSlot(cs[0], ctx.salon.user.id, { day: d, time: "10:00" }),
      requestSlot(cs[1], ctx.salon.user.id, { day: d, time: "10:30" }),
      requestSlot(cs[2], ctx.salon.user.id, { day: d, time: "10:00" })
    ]);
    expect([res[0].status, res[2].status].sort()).toEqual([201, 409]);
    expect(res[1].status).toBe(201);
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
  });

  it("closing time: a visit ending exactly at close is fine, one spilling past (or starting at) close is refused", async () => {
    const ctx = await makeSalon("A1 Closing", { staffCount: 1, services: [{ name: "S30", duration: "۳۰ دقیقه" }, { name: "S60", duration: "۶۰ دقیقه" }] });
    const cs = await clients(4);
    const d = day(2); // 10:00-20:00
    expect((await requestSlot(cs[0], ctx.salon.user.id, { day: d, time: "19:30" })).status).toBe(201);
    const spill = await requestSlot(cs[1], ctx.salon.user.id, { service: "S60", day: d, time: "19:30" });
    expect(spill.status).toBe(409);
    expect((await requestSlot(cs[2], ctx.salon.user.id, { day: d, time: "20:00" })).status).toBe(409);
    const spill2 = await requestSlot(cs[3], ctx.salon.user.id, { service: "S60", day: d, time: "19:00" });
    // 19:00-20:00 touches 19:30-20:00 held by cs[0] -> 409, not 5xx
    expect(spill2.status).toBe(409);
    // before opening
    expect((await requestSlot(cs[3], ctx.salon.user.id, { day: d, time: "09:30" })).status).toBe(409);
    // garbage time is refused, never a 5xx
    for (const time of ["25:00", "abc", "10:07", "-5:00", "۱۰:۰۰:۰۰"]) {
      const res = await requestSlot(cs[3], ctx.salon.user.id, { day: d, time });
      expect(res.status, `time ${time}`).toBeLessThan(500);
    }
  });

  it("visit made of two services racing single services for the same two people", async () => {
    const ctx = await makeSalon("A1 Parts Race", { staffCount: 2, services: [{ name: "S30", duration: "۳۰ دقیقه" }, { name: "S60", duration: "۶۰ دقیقه" }] });
    for (let round = 0; round < 4; round += 1) {
      const cs = await clients(4);
      const d = day(2 + round);
      const res = await Promise.all([
        requestSlot(cs[0], ctx.salon.user.id, { parts: ["S30", "S60"], day: d, time: "10:00" }),
        requestSlot(cs[1], ctx.salon.user.id, { service: "S30", day: d, time: "10:00" }),
        requestSlot(cs[2], ctx.salon.user.id, { service: "S60", day: d, time: "10:30" }),
        requestSlot(cs[3], ctx.salon.user.id, { parts: ["S60", "S30"], day: d, time: "10:00" })
      ]);
      expect(res.every((r) => r.status < 500), `5xx ${res.map((r) => r.status)}`).toBe(true);
      expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
      // every accepted multi-service visit has a person for every service
      for (const r of res.filter((x) => x.status === 201 && x.payload.data.booking.parts)) {
        const parts = JSON.parse(r.payload.data.booking.parts);
        expect(parts.every((p) => p.staff), JSON.stringify(parts)).toBe(true);
      }
    }
  });

  it("a salon with nobody on the team: simultaneous requests for one time give exactly one place", async () => {
    const ctx = await makeSalon("A1 Solo");
    const cs = await clients(4);
    const d = day(2);
    const res = await Promise.all(cs.map((c) => requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" })));
    expect(res.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
  });
});

describe("capacity: unassigned entries and the salon_hours.capacity number", () => {
  it("a walk-in the salon typed in without an artist still takes a place: a client cannot be put on the only artist at that time", async () => {
    const ctx = await makeSalon("A1 Walkin", { staffCount: 1 });
    const d = day(2);
    const own = await ctx.salonClient.post("/api/salon-bookings", { service: "S30", bookingDate: d, time: "10:00", client: "حضوری" });
    expect(own.status).toBe(201);
    const c = await makeClient();
    const res = await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" });
    // the only person is busy with the walk-in: SHOULD be refused (or the walk-in must have been given to the artist)
    expect(res.status, JSON.stringify({ walkin: own.payload.data.booking.staff, client: res.payload.data?.booking?.staff })).toBe(409);
  });

  it("order does not matter: client first, then the salon's unassigned walk-in at the same time", async () => {
    const ctx = await makeSalon("A1 Walkin2", { staffCount: 1 });
    const d = day(2);
    const c = await makeClient();
    expect((await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" })).status).toBe(201);
    const own = await ctx.salonClient.post("/api/salon-bookings", { service: "S30", bookingDate: d, time: "10:00", client: "حضوری" });
    expect(own.status).toBe(409);
  });

  it("salon_hours.capacity (how many a day takes) is honoured", async () => {
    const ctx = await makeSalon("A1 Capacity", { staffCount: 1 });
    const d = day(2);
    // capacity of the weekday of d set to 1
    const hours = (await ctx.salonClient.get("/api/salon-hours")).payload.data.hours;
    const { getPersianWeekday } = await import("../../app/shared/lib/persianCalendar.js");
    const { persianDateKeyToDate } = await import("../../app/shared/lib/persianCalendar.js");
    const weekday = getPersianWeekday(persianDateKeyToDate(d));
    const row = hours.find((h) => h.day.replace(/\s/g, "") === weekday.replace(/\s/g, ""));
    expect(row, `weekday ${weekday}`).toBeTruthy();
    const upd = await ctx.salonClient.patch("/api/salon-hours", { day: row.day, capacity: 1 });
    expect(upd.ok).toBe(true);
    const a = await makeClient();
    const b = await makeClient();
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const second = await requestSlot(b, ctx.salon.user.id, { day: d, time: "12:00" });
    expect(first.status).toBe(201);
    // FINDING if 201: capacity=1 is stored but never enforced.
    expect(second.status, "capacity 1 but a second booking on the same day was accepted").toBe(409);
  });

  it("all staff on leave: a client request is not accepted for nobody", async () => {
    const ctx = await makeSalon("A1 Leave", { staffCount: 2 });
    for (const person of ctx.staff) {
      const r = await ctx.salonClient.patch("/api/salon-staff", { id: person.row.id, state: "مرخصی" });
      expect(r.ok, JSON.stringify(r.payload)).toBe(true);
    }
    const c = await makeClient();
    const res = await requestSlot(c, ctx.salon.user.id, { day: day(2), time: "10:00" });
    expect(res.status, `accepted with staff='${res.payload.data?.booking?.staff}'`).toBe(409);
  });
});

describe("one person in several places at once", () => {
  it("a client double-submits the identical request in parallel and in sequence: one booking only", async () => {
    const ctx = await makeSalon("A1 Double", { staffCount: 2 });
    const c = await makeClient();
    const d = day(2);
    const res = await Promise.all([1, 2, 3].map(() => requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" })));
    const created = res.filter((r) => r.status === 201);
    expect(created.length, `parallel double tap: ${res.map((r) => r.status)}`).toBe(1);
    const again = await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" });
    expect(again.status).toBe(409);
    const rows = (await db.query("SELECT id FROM salon_bookings WHERE salon_user_id = $1 AND client_user_id = $2 AND status <> ALL($3)", [ctx.salon.user.id, c.user.id, ["لغو", "منقضی شده"]])).rows;
    expect(rows.length).toBe(1);
  });

  it("the same client asks for two overlapping times at the same salon (two staff): they cannot be in two chairs", async () => {
    const ctx = await makeSalon("A1 Selfclash", { staffCount: 2 });
    const c = await makeClient();
    const d = day(2);
    const a = await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" });
    const b = await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" });
    expect(a.status).toBe(201);
    // design question: a client holding two places at the same minute
    expect(b.status, "same client got two simultaneous places").toBe(409);
  });

  it("the same client asks two different salons for the same hour", async () => {
    const one = await makeSalon("A1 Pair One", { staffCount: 1 });
    const two = await makeSalon("A1 Pair Two", { staffCount: 1 });
    const c = await makeClient();
    const d = day(2);
    const a = await requestSlot(c, one.salon.user.id, { day: d, time: "10:00" });
    const b = await requestSlot(c, two.salon.user.id, { day: d, time: "10:00" });
    expect(a.status).toBe(201);
    // design question
    expect(b.status, "same client holds the same hour at two salons").toBe(409);
  });

  it("one artist who works in two salons and also takes direct bookings: three entry points at the same moment, one winner", async () => {
    const salonA = await makeSalon("A1 Multi SalonA", { staffCount: 0 });
    const salonB = await makeSalon("A1 Multi SalonB", { staffCount: 0 });
    const { createClient: mk, registerUser: reg, joinSalonAsArtist } = await import("./angle1Helpers.js");
    const artistClient = mk();
    const artist = await reg(artistClient, { type: "artist", name: "A1 Shared Artist" });
    expect((await artistClient.post("/api/artist/me", { name: "S30", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
    expect((await joinSalonAsArtist(artistClient, salonA.salonClient, salonA.salon.user.id)).ok).toBe(true);
    expect((await joinSalonAsArtist(artistClient, salonB.salonClient, salonB.salon.user.id)).ok).toBe(true);
    for (const s of [salonA, salonB]) {
      const r = await s.salonClient.post("/api/salon-services", { name: "S30", price: "100", duration: "۳۰ دقیقه" });
      expect(r.ok).toBe(true);
    }
    for (let round = 0; round < 4; round += 1) {
      const cs = await clients(3);
      const d = day(2 + round);
      const time = ["10:00", "11:00", "12:00", "13:00"][round];
      const res = await Promise.all([
        requestSlot(cs[0], salonA.salon.user.id, { day: d, time }),
        requestSlot(cs[1], salonB.salon.user.id, { day: d, time }),
        cs[2].client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "S30", bookingDate: d, time })
      ]);
      expect(res.every((r) => r.status < 500), `5xx ${res.map((r) => r.status)}`).toBe(true);
      expect(res.filter((r) => r.status === 201).length, `round ${round}: ${res.map((r) => r.status)}`).toBe(1);
      const rows = (await db.query("SELECT id, status, source_salon_user_id FROM artist_bookings WHERE artist_user_id = $1 AND booking_date = $2 AND time = $3 AND status <> ALL($4)", [artist.user.id, d, time, ["لغو", "منقضی شده"]])).rows;
      expect(rows.length, JSON.stringify(rows)).toBe(1);
      // the loser salon bookings: none may stay active without the artist's calendar copy
      for (const [salon, r] of [[salonA, res[0]], [salonB, res[1]]]) {
        if (r.status !== 201) {
          const active = (await db.query("SELECT id, status FROM salon_bookings WHERE salon_user_id = $1 AND booking_date = $2 AND time = $3 AND status <> ALL($4)", [salon.salon.user.id, d, time, ["لغو", "منقضی شده"]])).rows;
          expect(active, "loser left an active salon booking").toEqual([]);
        }
      }
    }
  });

  it("a refused request leaves no cancelled ghost row in the client's own list", async () => {
    const salon = await makeSalon("A1 Ghost", { staffCount: 0 });
    const { createClient: mk, registerUser: reg, joinSalonAsArtist } = await import("./angle1Helpers.js");
    const artistClient = mk();
    const artist = await reg(artistClient, { type: "artist", name: "A1 Ghost Artist" });
    expect((await artistClient.post("/api/artist/me", { name: "S30", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
    expect((await joinSalonAsArtist(artistClient, salon.salonClient, salon.salon.user.id)).ok).toBe(true);
    const d = day(2);
    // 6 pairs of (salon request, direct request) fired together; collect the clients that were refused
    const refusedClients = [];
    for (let round = 0; round < 6; round += 1) {
      const a = await makeClient();
      const b = await makeClient();
      const time = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"][round];
      const res = await Promise.all([
        requestSlot(a, salon.salon.user.id, { day: d, time }),
        b.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "S30", bookingDate: d, time })
      ]);
      if (res[0].status === 409) refusedClients.push(a);
    }
    for (const c of refusedClients) {
      const mine = (await c.client.get("/api/salon-bookings")).payload.data.bookings;
      expect(mine, "client was told 409 but sees a booking row").toEqual([]);
    }
  });
});
