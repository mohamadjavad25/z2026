import { describe, it, expect, afterAll } from "vitest";
import {
  openDb, makeSalon, makeClient, requestSlot, overlapViolations, futureBookingDay, createClient, registerUser,
  sweep, sendBack, statusOf, salonView
} from "./angle1Helpers.js";

const { db, connected } = openDb();
afterAll(async () => { await connected; await db.end(); });

const day = (n = 2) => futureBookingDay(n, { notOn: ["پنجشنبه"] });
const mirrors = async (salonId, d, time) => (await db.query(
  "SELECT id, artist_user_id, status FROM artist_bookings WHERE source_salon_user_id = $1 AND booking_date = $2 AND time = $3 ORDER BY id", [salonId, d, time]
)).rows;
const approve = (ctx, id) => ctx.salonClient.patch("/api/salon-bookings", { id, status: "تایید شده" });
const cancelByClient = (c, id) => c.client.post(`/api/salon-bookings/${id}/cancel`, {});

describe("who gets the slot while a request waits", () => {
  it("B is refused while A's request waits; once A cancels, B gets it; a refused B never gets a half-booking", async () => {
    const ctx = await makeSalon("A1 Wait Basic", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const b = await makeClient("A1 B");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    expect(first.status).toBe(201);
    expect((await requestSlot(b, ctx.salon.user.id, { day: d, time: "10:00" })).status).toBe(409);
    expect((await requestSlot(b, ctx.salon.user.id, { day: d, time: "10:00", waitMinutes: null })).status).toBe(409);
    expect((await cancelByClient(a, first.payload.data.booking.id)).status).toBe(200);
    const second = await requestSlot(b, ctx.salon.user.id, { day: d, time: "10:00" });
    expect(second.status).toBe(201);
    // A's copy on the artist's calendar was released, B's is the only live one
    const live = (await mirrors(ctx.salon.user.id, d, "10:00")).filter((m) => m.status !== "لغو");
    expect(live.length).toBe(1);
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
  });

  it("A's request expires by the sweep: B takes the slot, A's statuses (salon, client, artist copy) agree", async () => {
    const ctx = await makeSalon("A1 Wait Expire", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const b = await makeClient("A1 B");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    await sendBack(db, first.payload.data.booking.id, 61);
    expect((await sweep()).status).toBe(200);
    const second = await requestSlot(b, ctx.salon.user.id, { day: d, time: "10:00" });
    expect(second.status).toBe(201);
    expect(await statusOf(a, first.payload.data.booking.id)).toBe("منقضی شده");
    expect((await salonView(ctx.salonClient, first.payload.data.booking.id)).status).toBe("منقضی شده");
    const rows = await mirrors(ctx.salon.user.id, d, "10:00");
    const expired = rows.find((m) => m.status === "منقضی شده");
    expect(expired, JSON.stringify(rows)).toBeTruthy();
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
  });

  it("a request whose hour has run out is not still blocking the slot / still approvable before the sweep gets to it", async () => {
    const ctx = await makeSalon("A1 Wait Lapsed", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const b = await makeClient("A1 B");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const id = first.payload.data.booking.id;
    await sendBack(db, id, 90); // 30 minutes past its hour, not swept yet
    const blocked = await requestSlot(b, ctx.salon.user.id, { day: d, time: "10:00" });
    // design question: the slot of a request nobody can answer any more stays blocked until the sweep runs
    expect(blocked.status, "slot of a lapsed (unswept) request still blocks other clients").toBe(201);
  });

  it("an hour-lapsed, unswept request can no longer be approved (the screens say «time is up»)", async () => {
    const ctx = await makeSalon("A1 Wait Lapsed2", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const id = first.payload.data.booking.id;
    await sendBack(db, id, 90);
    const res = await approve(ctx, id);
    expect(res.status, "approve after the client's chosen window ran out succeeded").toBe(409);
  });

  it("a request whose appointment time has started cannot be approved any more", async () => {
    const ctx = await makeSalon("A1 Wait Started", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00", waitMinutes: null });
    const id = first.payload.data.booking.id;
    // pretend it is today and 00:01 (already started)
    const { formatPersianDateKey } = await import("../../app/shared/lib/persianCalendar.js");
    await db.query("UPDATE salon_bookings SET booking_date = $2, time = '00:01' WHERE id = $1", [id, formatPersianDateKey(new Date())]);
    const res = await approve(ctx, id);
    expect(res.status, "approved a request whose appointment already started").toBe(409);
  });

  it("an open-ended request (wait until appointment) does not expire by the hour, and a sweep storm leaves it alone", async () => {
    const ctx = await makeSalon("A1 Wait Open", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00", waitMinutes: null });
    await sendBack(db, first.payload.data.booking.id, 100000);
    const outs = await Promise.all(Array.from({ length: 6 }, () => sweep()));
    expect(outs.every((o) => o.status === 200)).toBe(true);
    expect(await statusOf(a, first.payload.data.booking.id)).toBe("درخواست");
  });
});

describe("the salon moves a waiting request (offers another time)", () => {
  it("old slot is freed, new slot is held, accept confirms, decline frees; artist copy follows", async () => {
    const ctx = await makeSalon("A1 Offer", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const b = await makeClient("A1 B");
    const c = await makeClient("A1 C");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const id = first.payload.data.booking.id;
    const moved = await ctx.salonClient.patch("/api/salon-bookings", { id, time: "12:00" });
    expect(moved.status, JSON.stringify(moved.payload)).toBe(200);
    expect(moved.payload.data.booking.status).toBe("در انتظار مشتری");
    // old slot is free for B, new slot is held against C
    expect((await requestSlot(b, ctx.salon.user.id, { day: d, time: "10:00" })).status).toBe(201);
    expect((await requestSlot(c, ctx.salon.user.id, { day: d, time: "12:00" })).status).toBe(409);
    // the salon cannot approve over the client's head
    expect((await approve(ctx, id)).status).toBe(409);
    // A accepts
    const acc = await a.client.post(`/api/salon-bookings/${id}/answer`, { accept: true });
    expect(acc.status, JSON.stringify(acc.payload)).toBe(200);
    expect(await statusOf(a, id)).toBe("تایید شده");
    const rows = await mirrors(ctx.salon.user.id, d, "12:00");
    expect(rows.map((r) => r.status), JSON.stringify(rows)).toContain("تایید شده");
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
  });

  it("accept and decline at the same moment: one wins, and everybody sees the same final status", async () => {
    const ctx = await makeSalon("A1 Offer Race", { staffCount: 1 });
    for (let round = 0; round < 5; round += 1) {
      const a = await makeClient("A1 A");
      const d = day(2 + round);
      const time = ["10:00", "12:00", "14:00", "16:00", "18:00"][round];
      const first = await requestSlot(a, ctx.salon.user.id, { day: d, time });
      const id = first.payload.data.booking.id;
      const moved = await ctx.salonClient.patch("/api/salon-bookings", { id, time: round % 2 ? "10:30" : "15:00" });
      expect(moved.status, JSON.stringify(moved.payload)).toBe(200);
      const [x, y] = await Promise.all([
        a.client.post(`/api/salon-bookings/${id}/answer`, { accept: true }),
        a.client.post(`/api/salon-bookings/${id}/answer`, { accept: false })
      ]);
      expect([x.status, y.status].every((s) => s < 500), `${x.status} ${y.status}`).toBe(true);
      expect([x.status, y.status].filter((s) => s === 200).length, `${x.status} ${y.status}`).toBe(1);
      const clientSees = await statusOf(a, id);
      const salonSees = (await salonView(ctx.salonClient, id)).status;
      expect(clientSees).toBe(salonSees);
      const finalDay = (await salonView(ctx.salonClient, id)).booking_date;
      const copies = (await db.query("SELECT status FROM artist_bookings WHERE salon_booking_id = $1 OR (source_salon_user_id = $2 AND booking_date = $3 AND client_user_id = $4)", [id, ctx.salon.user.id, finalDay, a.user.id])).rows;
      for (const copy of copies.filter((r) => r.status !== "منقضی شده")) {
        expect(copy.status === "لغو", `artist copy ${copy.status} vs ${salonSees}`).toBe(salonSees === "لغو");
      }
    }
  });

  it("client accepts while the salon moves the booking again: no 5xx, nothing double booked", async () => {
    const ctx = await makeSalon("A1 Offer Race2", { staffCount: 1 });
    for (let round = 0; round < 5; round += 1) {
      const a = await makeClient("A1 A");
      const d = day(2 + round);
      const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
      const id = first.payload.data.booking.id;
      expect((await ctx.salonClient.patch("/api/salon-bookings", { id, time: "13:00" })).status).toBe(200);
      const [acc, mv] = await Promise.all([
        a.client.post(`/api/salon-bookings/${id}/answer`, { accept: true }),
        ctx.salonClient.patch("/api/salon-bookings", { id, time: "15:00" })
      ]);
      expect(acc.status).toBeLessThan(500);
      expect(mv.status).toBeLessThan(500);
      const row = await salonView(ctx.salonClient, id);
      // accepted at 13:00 then maybe moved again (back to waiting for 15:00), or moved first and the accept hit the new offer: all valid; it must be one of:
      expect(["تایید شده", "در انتظار مشتری"]).toContain(row.status);
      expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
      // the artist's copy must be at the very time and day the salon row says
      const copies = (await db.query("SELECT time, booking_date, status FROM artist_bookings WHERE salon_booking_id = $1 OR (source_salon_user_id = $2 AND client_user_id = $3 AND status <> 'لغو')", [id, ctx.salon.user.id, a.user.id])).rows;
      for (const copy of copies) expect(`${copy.booking_date} ${copy.time}`, `copy vs row ${row.time}`).toBe(`${row.booking_date} ${row.time}`);
    }
  });

  it("an offer nobody answers: it is not stuck forever (design: how long does the new time stay held?)", async () => {
    const ctx = await makeSalon("A1 Offer Stuck", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const b = await makeClient("A1 B");
    const d = day(5);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const id = first.payload.data.booking.id;
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id, time: "12:00" })).status).toBe(200);
    await sendBack(db, id, 60 * 24 * 3); // the client has been silent for 3 days
    await sweep();
    // after 3 days of silence the new time is still held for nobody
    const other = await requestSlot(b, ctx.salon.user.id, { day: d, time: "12:00" });
    expect(other.status, "a never-answered offer still holds the time after 3 days").toBe(201);
  });
});

describe("the salon changes things under a waiting request", () => {
  it("removing the team member while a request waits: cancelling it must free the artist's calendar", async () => {
    const ctx = await makeSalon("A1 Remove Staff", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const id = first.payload.data.booking.id;
    expect((await mirrors(ctx.salon.user.id, d, "10:00")).length).toBe(1);
    const del = await ctx.salonClient.delete("/api/salon-staff", { id: ctx.staff[0].row.id });
    expect(del.status, JSON.stringify(del.payload)).toBeLessThan(500);
    const res = await cancelByClient(a, id);
    expect(res.status).toBeLessThan(500);
    const live = (await db.query(
      "SELECT id, status FROM artist_bookings WHERE artist_user_id = $1 AND booking_date = $2 AND status <> ALL($3)",
      [ctx.staff[0].artist.user.id, d, ["لغو", "لغو شده", "cancelled", "منقضی شده"]]
    )).rows;
    expect(live, "the cancelled/removed booking still blocks the former artist's calendar").toEqual([]);
  });

  it("removing the team member while a request waits: the request then expires; the artist's calendar is freed", async () => {
    const ctx = await makeSalon("A1 Remove Staff2", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const id = first.payload.data.booking.id;
    await ctx.salonClient.delete("/api/salon-staff", { id: ctx.staff[0].row.id });
    await sendBack(db, id, 61);
    expect((await sweep()).status).toBe(200);
    expect(await statusOf(a, id)).toBe("منقضی شده");
    const live = (await db.query(
      "SELECT id, status FROM artist_bookings WHERE artist_user_id = $1 AND booking_date = $2 AND status <> ALL($3)",
      [ctx.staff[0].artist.user.id, d, ["لغو", "لغو شده", "cancelled", "منقضی شده"]]
    )).rows;
    expect(live, "expired booking still blocks the former artist's calendar").toEqual([]);
  });

  it("removing the team member while a request waits: approving it must not leave the artist's copy waiting forever", async () => {
    const ctx = await makeSalon("A1 Remove Staff3", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const d = day(2);
    const first = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const id = first.payload.data.booking.id;
    await ctx.salonClient.delete("/api/salon-staff", { id: ctx.staff[0].row.id });
    const res = await approve(ctx, id);
    expect(res.status).toBeLessThan(500);
    const copies = (await db.query("SELECT status FROM artist_bookings WHERE artist_user_id = $1 AND booking_date = $2", [ctx.staff[0].artist.user.id, d])).rows;
    // either approved with the booking, or dropped -- never still 'درخواست' under a confirmed salon booking
    for (const copy of copies) expect(copy.status, JSON.stringify(copies)).not.toBe("درخواست");
  });

  it("deleting the service, closing the day or shrinking the hours while a request waits: no 5xx, approve is consistent", async () => {
    const ctx = await makeSalon("A1 Change Hours", { staffCount: 1 });
    const a = await makeClient("A1 A");
    const b = await makeClient("A1 B");
    const d = day(2);
    const r1 = await requestSlot(a, ctx.salon.user.id, { day: d, time: "18:00" });
    const r2 = await requestSlot(b, ctx.salon.user.id, { day: d, time: "19:00" });
    // delete the service
    const del = await ctx.salonClient.delete("/api/salon-services", { id: ctx.services[0].id });
    expect(del.status).toBeLessThan(500);
    // shrink the hours of that weekday to 10-17 (both requests now lie outside the hours)
    const { getPersianWeekday, persianDateKeyToDate } = await import("../../app/shared/lib/persianCalendar.js");
    const weekday = getPersianWeekday(persianDateKeyToDate(d));
    const hours = (await ctx.salonClient.get("/api/salon-hours")).payload.data.hours;
    const row = hours.find((h) => h.day.replace(/\s/g, "") === weekday.replace(/\s/g, ""));
    expect((await ctx.salonClient.patch("/api/salon-hours", { day: row.day, open_time: "10:00", close_time: "17:00" })).ok).toBe(true);
    const ra = await approve(ctx, r1.payload.data.booking.id);
    expect(ra.status).toBeLessThan(500);
    // close the day completely
    expect((await ctx.salonClient.patch("/api/salon-hours", { day: row.day, active: false })).ok).toBe(true);
    const rb = await approve(ctx, r2.payload.data.booking.id);
    expect(rb.status).toBeLessThan(500);
    // product question: approving a request that lies outside the new hours / on a closed day
    expect(rb.status, "approved a request on a day the salon has since closed").toBe(409);
    const t = await ctx.salonClient.get(`/api/salon-bookings/${r1.payload.data.booking.id}/times`);
    expect(t.status).toBeLessThan(500);
  });
});

describe("expiry sweep run concurrently", () => {
  it("many parallel sweeps over many lapsed requests (with backup salons): each request closed once, moved once, no duplicate copies", async () => {
    const first = await makeSalon("A1 Sweep First", { staffCount: 2 });
    const second = await makeSalon("A1 Sweep Second", { staffCount: 2 });
    const d = day(2);
    const ids = [];
    const clients = [];
    for (let i = 0; i < 6; i += 1) {
      const c = await makeClient(`A1 Sweeper ${i}`);
      clients.push(c);
      expect((await c.client.post("/api/follows", { targetUserId: second.salon.user.id, follow: true })).ok).toBe(true);
      const time = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"][i];
      const r = await requestSlot(c, first.salon.user.id, { day: d, time, waitMinutes: 60, fallbackSalonUserId: second.salon.user.id });
      expect(r.status, JSON.stringify(r.payload)).toBe(201);
      ids.push(r.payload.data.booking.id);
      await sendBack(db, r.payload.data.booking.id, 61);
    }
    const outs = await Promise.all(Array.from({ length: 8 }, () => sweep()));
    expect(outs.every((o) => o.status === 200), JSON.stringify(outs)).toBe(true);
    const movedTotal = outs.reduce((n, o) => n + (o.data?.salonMoved || 0), 0);
    const expiredTotal = outs.reduce((n, o) => n + (o.data?.salonExpired || 0), 0);
    expect(expiredTotal, `each request must be closed by exactly one sweep: ${JSON.stringify(outs.map((o) => o.data))}`).toBe(6);
    expect(movedTotal).toBe(6);
    const copies = (await db.query("SELECT moved_from_booking_id, COUNT(*)::int AS n FROM salon_bookings WHERE moved_from_booking_id = ANY($1) GROUP BY 1", [ids])).rows;
    expect(copies.length).toBe(6);
    for (const row of copies) expect(row.n, `request ${row.moved_from_booking_id} was copied ${row.n} times`).toBe(1);
    expect(await overlapViolations(db, second.salon.user.id, d)).toEqual([]);
    expect(await overlapViolations(db, first.salon.user.id, d)).toEqual([]);
  });

  it("sweeps while requests are being created and answered: no 5xx anywhere, statuses end consistent", async () => {
    const ctx = await makeSalon("A1 Sweep Storm", { staffCount: 2 });
    const d = day(2);
    const lapsed = [];
    for (let i = 0; i < 4; i += 1) {
      const c = await makeClient(`A1 Lapsed ${i}`);
      const r = await requestSlot(c, ctx.salon.user.id, { day: d, time: ["10:00", "11:00", "12:00", "13:00"][i] });
      lapsed.push({ c, id: r.payload.data.booking.id });
      await sendBack(db, r.payload.data.booking.id, 61);
    }
    const fresh = [];
    for (let i = 0; i < 4; i += 1) fresh.push(await makeClient(`A1 Fresh ${i}`));
    const calls = [
      ...Array.from({ length: 6 }, () => sweep()),
      // new requests at the very slots being freed by the sweep
      ...fresh.map((c, i) => requestSlot(c, ctx.salon.user.id, { day: d, time: ["10:00", "11:00", "12:00", "13:00"][i] })),
      // the salon answers the lapsed ones at the same time
      ...lapsed.map((l) => approve(ctx, l.id)),
      ...lapsed.map((l) => cancelByClient(l.c, l.id))
    ];
    const results = await Promise.all(calls);
    for (const r of results) expect(r.status, JSON.stringify(r.payload ?? r.data)).toBeLessThan(500);
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
    for (const l of lapsed) {
      const salonSees = (await salonView(ctx.salonClient, l.id)).status;
      const clientSees = await statusOf(l.c, l.id);
      expect(clientSees).toBe(salonSees);
      expect(["تایید شده", "لغو", "منقضی شده"]).toContain(salonSees);
    }
    // a slot is never held by a dead request: every active booking is unique per staff & time (checked above) and
    // each slot has at most 2 live salon bookings (2 staff)
    const live = (await db.query("SELECT time, COUNT(*)::int n FROM salon_bookings WHERE salon_user_id = $1 AND booking_date = $2 AND status <> ALL($3) GROUP BY time", [ctx.salon.user.id, d, ["لغو", "منقضی شده"]])).rows;
    for (const row of live) expect(row.n).toBeLessThanOrEqual(2);
  });

  it("two lapsed requests from different clients have the same backup salon and slot: only one can move, the other just expires", async () => {
    const first = await makeSalon("A1 Fb First", { staffCount: 1 });
    const second = await makeSalon("A1 Fb Second", { staffCount: 1 });
    const d = day(2);
    // 2 staff at first salon so both can wait there for the same time
    const extra = createClient();
    const artist = await registerUser(extra, { type: "artist", name: "A1 Fb Extra" });
    const { joinSalonAsArtist } = await import("./angle1Helpers.js");
    expect((await joinSalonAsArtist(extra, first.salonClient, first.salon.user.id)).ok).toBe(true);
    const cs = [await makeClient("A1 Fb1"), await makeClient("A1 Fb2")];
    const ids = [];
    for (const c of cs) {
      await c.client.post("/api/follows", { targetUserId: second.salon.user.id, follow: true });
      const r = await requestSlot(c, first.salon.user.id, { day: d, time: "10:00", waitMinutes: 60, fallbackSalonUserId: second.salon.user.id });
      expect(r.status, JSON.stringify(r.payload)).toBe(201);
      ids.push(r.payload.data.booking.id);
      await sendBack(db, r.payload.data.booking.id, 61);
    }
    await Promise.all([sweep(), sweep(), sweep()]);
    const moved = (await db.query("SELECT id FROM salon_bookings WHERE salon_user_id = $1 AND booking_date = $2 AND status <> ALL($3)", [second.salon.user.id, d, ["لغو", "منقضی شده"]])).rows;
    expect(moved.length).toBe(1);
    for (const id of ids) expect(await statusOf(cs[ids.indexOf(id)], id)).toBe("منقضی شده");
  });
});

describe("robust input around the waiting window", () => {
  it("bad waitMinutes values and backup ids are refused or ignored, never a 5xx", async () => {
    const ctx = await makeSalon("A1 Bad Wait", { staffCount: 1 });
    const c = await makeClient();
    const d = day(2);
    const times = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
    const bad = [0, -1, 30, 61, 1440, "60", 1e9, true, [], {}, 60.5, "abc"];
    for (const [i, waitMinutes] of bad.entries()) {
      const res = await c.client.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: "S30", bookingDate: d, time: times[i], waitMinutes });
      expect(res.status, `waitMinutes=${JSON.stringify(waitMinutes)}`).toBe(400);
    }
    const fallbackIds = [99999999999, "99999999999", -5, 0, "abc", 1.5, ctx.salon.user.id, {}, [], "1e3"];
    for (const [i, fallbackSalonUserId] of fallbackIds.entries()) {
      const res = await c.client.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: "S30", bookingDate: d, time: times[i], waitMinutes: 60, fallbackSalonUserId });
      expect(res.status, `fallback=${JSON.stringify(fallbackSalonUserId)} ${JSON.stringify(res.payload)}`).toBeLessThan(500);
      if (res.status === 201) await cancelByClient(c, res.payload.data.booking.id);
    }
    for (const salonUserId of [99999999999, "99999999999", -1, 0, "abc", 1.5, null]) {
      const res = await c.client.post("/api/salon-bookings", { salonUserId, service: "S30", bookingDate: d, time: "10:00" });
      expect(res.status, `salonUserId=${JSON.stringify(salonUserId)}`).toBeLessThan(500);
    }
  });

  it("the same slot written five ways (Persian digits, no leading zero, relative day name) is one slot", async () => {
    const ctx = await makeSalon("A1 Spelling", { staffCount: 0 });
    const d = day(2);
    const cs = [];
    for (let i = 0; i < 4; i += 1) cs.push(await makeClient());
    const { toPersianDigits } = await import("../../app/shared/lib/digits.js");
    const spellings = [
      { bookingDate: d, time: "10:00" },
      { bookingDate: toPersianDigits(d), time: "۱۰:۰۰" },
      { bookingDate: d, time: "10:00:00" },
      { bookingDate: d, time: " 10:00 " }
    ];
    const res = await Promise.all(cs.map((c, i) => c.client.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: "S30", ...spellings[i] })));
    expect(res.every((r) => r.status < 500), res.map((r) => r.status).join()).toBe(true);
    expect(res.filter((r) => r.status === 201).length, res.map((r) => r.status).join()).toBe(1);
  });
});

describe("one account holding many places", () => {
  it("a single client can lock a whole one-artist day with open-ended requests", async () => {
    const ctx = await makeSalon("A1 Hoarder", { staffCount: 1 });
    const hoarder = await makeClient("A1 Hoarder");
    const victim = await makeClient("A1 Victim");
    const d = day(3);
    const times = [];
    for (let m = 10 * 60; m < 20 * 60; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    let accepted = 0;
    for (const time of times) {
      const r = await requestSlot(hoarder, ctx.salon.user.id, { day: d, time, waitMinutes: null });
      if (r.status === 201) accepted += 1;
    }
    const v = await requestSlot(victim, ctx.salon.user.id, { day: d, time: "15:00" });
    expect(accepted, `one client holds ${accepted} pending open-ended places on one day`).toBeLessThanOrEqual(3);
    expect(v.status).toBe(201);
  });
});
