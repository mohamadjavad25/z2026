import { describe, it, expect, afterAll } from "vitest";
import {
  openDb, makeSalon, makeClient, requestSlot, overlapViolations, futureBookingDay, createClient, registerUser,
  sweep, sendBack, statusOf, salonView, joinSalonAsArtist
} from "./angle1Helpers.js";

const { db, connected } = openDb();
afterAll(async () => { await connected; await db.end(); });

const day = (n = 2) => futureBookingDay(n, { notOn: ["پنجشنبه"] });
const DEAD = ["لغو", "لغو شده", "cancelled", "منقضی شده"];

async function makeArtist(name, withService = true) {
  const client = createClient();
  const artist = await registerUser(client, { type: "artist", name });
  if (withService) expect((await client.post("/api/artist/me", { name: "S30", price: "100", duration: "۳۰ دقیقه" })).ok).toBe(true);
  return { client, artist };
}
const direct = (c, artistId, d, time, extra = {}) => c.client.post("/api/artist/bookings", { artistUserId: artistId, service: "S30", bookingDate: d, time, ...extra });

describe("direct bookings with an independent artist", () => {
  it("an independent artist's own working hours / closed day are honoured for a client request", async () => {
    const { artist } = await makeArtist("A1 Hours Artist");
    const c = await makeClient();
    // default hours 10-20, Friday closed
    const friday = (() => { const d = new Date(); for (let i = 1; i < 14; i += 1) { const x = new Date(); x.setDate(x.getDate() + i); if (new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(x) === "جمعه") return x; } })();
    const { formatPersianDateKey } = await import("../../app/shared/lib/persianCalendar.js");
    const fridayKey = formatPersianDateKey(friday);
    const results = {};
    results.friday = (await direct(c, artist.user.id, fridayKey, "12:00")).status;
    results.night = (await direct(c, artist.user.id, day(2), "03:00")).status;
    results.lateNight = (await direct(c, artist.user.id, day(2), "23:30")).status;
    results.junkTime = (await direct(c, artist.user.id, day(3), "99:99")).status;
    results.noTime = (await direct(c, artist.user.id, day(3), "abc")).status;
    expect(Object.values(results).every((s) => s < 500), JSON.stringify(results)).toBe(true);
    expect(results, "direct booking accepted outside the artist's hours / on a closed day").toEqual({ friday: 409, night: 409, lateNight: 409, junkTime: 400, noTime: 400 });
  });

  it("N clients at the same moment for one artist: exactly one place; a double tap is one booking", async () => {
    const { artist } = await makeArtist("A1 Direct Race");
    const cs = [];
    for (let i = 0; i < 5; i += 1) cs.push(await makeClient());
    const d = day(2);
    const res = await Promise.all(cs.map((c) => direct(c, artist.user.id, d, "10:00")));
    expect(res.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
    const tap = await Promise.all([1, 2, 3].map(() => direct(cs[0], artist.user.id, d, "14:00")));
    expect(tap.filter((r) => r.status === 201).length).toBe(1);
  });

  it("one client or an anonymous visitor cannot hold an artist's whole day with pending requests", async () => {
    const { artist } = await makeArtist("A1 Direct Hoard");
    const c = await makeClient();
    const d = day(3);
    let held = 0;
    for (let m = 10 * 60; m < 20 * 60; m += 30) {
      const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      if ((await direct(c, artist.user.id, d, time, { waitMinutes: null })).status === 201) held += 1;
    }
    expect(held, `one client holds ${held} pending places with one artist`).toBeLessThanOrEqual(3);
  });

  it("anonymous (no login) request: refused, or at least it expires and can't be hoarded", async () => {
    const { artist } = await makeArtist("A1 Direct Anon");
    const anon = { client: createClient() };
    const d = day(3);
    const res = await direct(anon, artist.user.id, d, "10:00", { clientName: "x", clientPhone: "09120000000" });
    expect(res.status, "anonymous visitor can put a pending booking in an artist's calendar").toBeGreaterThanOrEqual(400);
  });

  it("parallel sweeps over lapsed direct requests with a backup artist: closed once, moved once", async () => {
    const first = await makeArtist("A1 Fb Artist One");
    const second = await makeArtist("A1 Fb Artist Two");
    const d = day(2);
    const ids = [];
    for (let i = 0; i < 4; i += 1) {
      const c = await makeClient();
      expect((await c.client.post("/api/follows", { targetUserId: second.artist.user.id, follow: true })).ok).toBe(true);
      const r = await direct(c, first.artist.user.id, d, ["10:00", "10:30", "11:00", "11:30"][i], { waitMinutes: 60, fallbackArtistUserId: second.artist.user.id });
      expect(r.status, JSON.stringify(r.payload)).toBe(201);
      ids.push(r.payload.data.booking.id);
      await sendBack(db, r.payload.data.booking.id, 61, "artist_bookings");
    }
    const outs = await Promise.all(Array.from({ length: 6 }, () => sweep()));
    expect(outs.every((o) => o.status === 200)).toBe(true);
    expect(outs.reduce((n, o) => n + (o.data?.artistExpired || 0), 0)).toBe(4);
    expect(outs.reduce((n, o) => n + (o.data?.artistMoved || 0), 0)).toBe(4);
    const copies = (await db.query("SELECT moved_from_booking_id, COUNT(*)::int n FROM artist_bookings WHERE moved_from_booking_id = ANY($1) GROUP BY 1", [ids])).rows;
    expect(copies.length).toBe(4);
    for (const r of copies) expect(r.n).toBe(1);
  });

  it("client cancels while the artist confirms: one outcome, consistent", async () => {
    const { client: artistClient, artist } = await makeArtist("A1 Direct Answer");
    for (let round = 0; round < 6; round += 1) {
      const c = await makeClient();
      const d = day(2 + round);
      const r = await direct(c, artist.user.id, d, "10:00");
      const id = r.payload.data.booking.id;
      const [cancel, confirm] = await Promise.all([
        c.client.post(`/api/artist-bookings/${id}/cancel`, {}),
        artistClient.patch("/api/artist/me", { kind: "booking", id, status: "تایید شده" })
      ]);
      expect(cancel.status).toBeLessThan(500);
      expect(confirm.status).toBeLessThan(500);
      const final = (await db.query("SELECT status FROM artist_bookings WHERE id = $1", [id])).rows[0].status;
      if (cancel.status === 200) expect(final, `cancel ${cancel.status} confirm ${confirm.status}`).toBe("لغو");
    }
  });
});

describe("salon booking mirrored into the artist's calendar", () => {
  it("the artist polling her own list while clients book her never makes a legitimate request fail", async () => {
    const ctx = await makeSalon("A1 Sync Race", { staffCount: 1 });
    const d = day(2);
    const times = [];
    for (let m = 10 * 60; m < 20 * 60; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    const cs = [];
    for (const _ of times) cs.push(await makeClient());
    let stop = false;
    const poll = (async () => { while (!stop) { await ctx.staff[0].artistClient.get("/api/artist/me"); } })();
    const polls = [poll, poll, poll, poll];
    const res = await Promise.all(cs.map((c, i) => requestSlot(c, ctx.salon.user.id, { day: d, time: times[i] })));
    stop = true;
    await Promise.all(polls);
    const failed = res.map((r, i) => [r.status, r.payload.code, times[i]]).filter(([s]) => s !== 201);
    expect(failed, "distinct free times, but some were refused / rolled back").toEqual([]);
    const live = (await db.query("SELECT COUNT(*)::int n FROM salon_bookings WHERE salon_user_id = $1 AND booking_date = $2 AND status <> ALL($3)", [ctx.salon.user.id, d, ["لغو", "منقضی شده"]])).rows[0].n;
    const liveCopies = (await db.query("SELECT COUNT(*)::int n FROM artist_bookings WHERE artist_user_id = $1 AND booking_date = $2 AND status <> ALL($3)", [ctx.staff[0].artist.user.id, d, DEAD])).rows[0].n;
    expect(liveCopies).toBe(live);
  });

  it("a salon-assigned artist copy and the salon row always agree after parallel answers (salon approve/cancel, artist confirm/decline, client cancel)", async () => {
    const ctx = await makeSalon("A1 Answers", { staffCount: 1 });
    const artistClient = ctx.staff[0].artistClient;
    for (let round = 0; round < 6; round += 1) {
      const c = await makeClient();
      // one day per round (day() skips Thursdays, so consecutive numbers can land on the same date)
      const d = day(2 + round * 2);
      const r = await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" });
      const id = r.payload.data.booking.id;
      const copy = (await db.query("SELECT id FROM artist_bookings WHERE source_salon_user_id = $1 AND booking_date = $2 AND time = '10:00' AND status <> ALL($3)", [ctx.salon.user.id, d, DEAD])).rows[0];
      const ops = [
        ctx.salonClient.patch("/api/salon-bookings", { id, status: "تایید شده" }),
        artistClient.patch("/api/artist/me", { kind: "booking", id: copy.id, status: round % 2 ? "لغو" : "تایید شده" }),
        c.client.post(`/api/salon-bookings/${id}/cancel`, {})
      ];
      const res = await Promise.all(ops);
      for (const x of res) expect(x.status, JSON.stringify(x.payload)).toBeLessThan(500);
      const salonSees = (await salonView(ctx.salonClient, id)).status;
      const clientSees = await statusOf(c, id);
      expect(clientSees).toBe(salonSees);
      const copyNow = (await db.query("SELECT status FROM artist_bookings WHERE id = $1", [copy.id])).rows[0].status;
      if (salonSees === "لغو") expect(DEAD, `artist copy '${copyNow}' vs salon 'لغو'`).toContain(copyNow);
      else expect(DEAD, `artist copy '${copyNow}' vs salon '${salonSees}'`).not.toContain(copyNow);
    }
  });

  it("a confirmed booking whose team member is removed: cancelling it still frees the artist's calendar", async () => {
    const ctx = await makeSalon("A1 Removed Confirmed", { staffCount: 1 });
    const c = await makeClient();
    const d = day(2);
    const r = await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" });
    const id = r.payload.data.booking.id;
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id, status: "تایید شده" })).status).toBe(200);
    await ctx.salonClient.delete("/api/salon-staff", { id: ctx.staff[0].row.id });
    expect((await c.client.post(`/api/salon-bookings/${id}/cancel`, {})).status).toBeLessThan(500);
    const live = (await db.query("SELECT id, status FROM artist_bookings WHERE artist_user_id = $1 AND booking_date = $2 AND status <> ALL($3)", [ctx.staff[0].artist.user.id, d, DEAD])).rows;
    expect(live, "artist still has a live copy of a cancelled booking").toEqual([]);
  });

  it("a former team member can clear the leftover copy herself, and then is free again", async () => {
    const ctx = await makeSalon("A1 Removed Leftover", { staffCount: 1 });
    const c = await makeClient();
    const d = day(2);
    await requestSlot(c, ctx.salon.user.id, { day: d, time: "10:00" });
    await ctx.salonClient.delete("/api/salon-staff", { id: ctx.staff[0].row.id });
    const mine = (await ctx.staff[0].artistClient.get("/api/artist/me")).payload.data.bookings.filter((b) => b.booking_date === d);
    expect(mine.length, "former artist's list").toBeGreaterThanOrEqual(0);
    const stuck = (await db.query("SELECT id, status FROM artist_bookings WHERE artist_user_id = $1 AND booking_date = $2 AND status <> ALL($3)", [ctx.staff[0].artist.user.id, d, DEAD])).rows;
    // when the salon removes the member, bookings still waiting for them should be handed back or closed
    expect(stuck, "request from a salon the artist left is still waiting in her calendar").toEqual([]);
  });

  it("two salon bookings re-assigned to the same person at the same moment: never both", async () => {
    const ctx = await makeSalon("A1 Reassign", { staffCount: 2, services: [{ name: "S30", duration: "۳۰ دقیقه" }] });
    const d = day(2);
    const a = await makeClient();
    const b = await makeClient();
    const ra = await requestSlot(a, ctx.salon.user.id, { day: d, time: "10:00" });
    const rb = await requestSlot(b, ctx.salon.user.id, { day: d, time: "10:00" });
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    const target = ctx.staff[0].row.name;
    const res = await Promise.all([
      ctx.salonClient.patch("/api/salon-bookings", { id: ra.payload.data.booking.id, staff: target }),
      ctx.salonClient.patch("/api/salon-bookings", { id: rb.payload.data.booking.id, staff: target })
    ]);
    for (const x of res) expect(x.status).toBeLessThan(500);
    expect(await overlapViolations(db, ctx.salon.user.id, d)).toEqual([]);
  });
});
