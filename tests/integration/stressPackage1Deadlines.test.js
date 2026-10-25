import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  openDb, clearThrottles, makeSalon, makeClients, get, post, patch, call, tally, bad, note, slotBody, futureBookingDay, sweepNow, jitter,
  createClient, registerUser, overlapViolations
} from "./stressPackage1Helpers.js";
import { AWAITING_CLIENT } from "../../app/shared/lib/bookingOffer.js";

/**
 * Package 1 under load, part B: the deadline of a request (an hour, "any time" = 24 hours at most) and of an offered
 * new time (6 hours), raced at the exact boundary against approve, the sweep, the client cancelling and the client
 * answering. The clock is controlled by moving created_at / offer_at in the database, never by waiting.
 */
const { db, connected } = openDb();
beforeAll(async () => { await connected; });
afterAll(async () => { await db.end(); });

const day = (n = 2) => futureBookingDay(n, { notOn: ["پنجشنبه"] });
const SERVICES = [{ name: "S30", duration: "۳۰ دقیقه" }, { name: "S60", duration: "۶۰ دقیقه" }];
const DEAD_COPY = ["لغو", "لغو شده", "cancelled", "منقضی شده"];
const ROUNDS = 24;
/** 30-minute grid from 10:00 (round 0) up; the salon is open 10:00-20:00 and takes starts on the half hour only. */
const slotTime = (n0) => slotTimeRaw(n0 % 10);
const slotTimeRaw = (n) => `${String(10 + Math.floor(n / 2)).padStart(2, "0")}:${n % 2 ? "30" : "00"}`;
const ascii = (t) => String(t).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
let pool = [];
/** An operation that starts after a random 0-40 ms, so the operations land on both sides of the deadline. */
const racer = (op, fn) => (async () => { await jitter(40); return { op, ...(await fn()) }; })();

/** Set created_at so the request has exactly `leftMs` milliseconds of its window left (negative = already lapsed). */
const ageRequest = (id, leftMs, windowMinutes = 60) =>
  db.query("UPDATE salon_bookings SET created_at = NOW() - make_interval(secs => $2::double precision) WHERE id = $1", [id, windowMinutes * 60 - leftMs / 1000]);
const ageOffer = (id, leftMs) =>
  db.query("UPDATE salon_bookings SET offer_at = NOW() - make_interval(secs => $2::double precision) WHERE id = $1", [id, 6 * 3600 - leftMs / 1000]);
const rowOf = async (id) => (await db.query("SELECT * FROM salon_bookings WHERE id = $1", [id])).rows[0];
const copiesOf = async (salonId, row) => (await db.query(
  "SELECT id, artist_user_id, status, time, booking_date FROM artist_bookings WHERE source_salon_user_id = $1 AND client_user_id = $2 ORDER BY id",
  [salonId, row.client_user_id]
)).rows;

/** The calendar copy must say the same thing as the booking. Returns a list of problems. */
async function copyProblems(salonId, id) {
  const row = await rowOf(id);
  const copies = await copiesOf(salonId, row);
  const live = copies.filter((c) => !DEAD_COPY.includes(c.status));
  const problems = [];
  if (["لغو", "منقضی شده"].includes(row.status)) {
    if (live.length) problems.push(`booking ${row.status} but ${live.length} live calendar copies (${live.map((c) => c.status)})`);
  } else {
    if (live.length !== 1) problems.push(`booking ${row.status} but ${live.length} live calendar copies`);
    else {
      const [copy] = live;
      if (row.status === "تایید شده" && copy.status !== "تایید شده") problems.push(`confirmed booking, copy is ${copy.status}`);
      if (row.status === "درخواست" && copy.status !== "درخواست") problems.push(`open request, copy is ${copy.status}`);
      if (row.status !== AWAITING_CLIENT && String(copy.time).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)) !== String(row.time).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))) problems.push(`copy time ${copy.time} vs ${row.time}`);
    }
  }
  return problems;
}

describe("4a) a request's hour, raced at its last moment", () => {
  beforeAll(async () => { pool = await makeClients(ROUNDS * 2, "P1 Dl"); }, 240_000);

  it(`${ROUNDS} rounds: approve vs 2 sweeps vs client cancel vs a 2nd approve, when the hour runs out within -15..+55 ms of the start`, async () => {
    await clearThrottles(db);
    const ctx = await makeSalon("P1 Deadline Salon", { staffCount: 5, services: SERVICES });
    const d = day(3);
    const finals = {};
    for (let round = 0; round < ROUNDS; round += 1) {
      const c = pool[round];
      const time = slotTime(round);
      const made = await post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time }));
      expect(made.status).toBe(201);
      const id = made.payload.data.booking.id;
      const left = Math.floor(Math.random() * 70) - 15;
      await ageRequest(id, left);
      const ops = await Promise.all([
        racer("approve", () => patch(ctx.salonClient, "/api/salon-bookings", { id, status: "تایید شده" })),
        racer("approve2", () => patch(ctx.salonClient, "/api/salon-bookings", { id, status: "تایید شده" })),
        racer("sweep1", () => sweepNow()),
        racer("sweep2", () => sweepNow()),
        racer("cancel", () => post(c.client, `/api/salon-bookings/${id}/cancel`, {}))
      ]);
      expect(bad(ops).map((o) => `${o.op} ${o.status}`)).toEqual([]);
      const row = await rowOf(id);
      const ok = (name) => ops.some((o) => o.op === name && o.status === 200);
      const approved = ok("approve") || ok("approve2");
      const cancelled = ok("cancel");
      const label = `round ${round} left=${left}ms ops=${ops.map((o) => `${o.op}:${o.status}`)} final=${row.status}`;
      if (cancelled) expect(row.status, label).toBe("لغو");
      else if (approved) expect(row.status, label).toBe("تایید شده");
      else expect(["منقضی شده", "درخواست"], label).toContain(row.status);
      // both approves must never both win
      expect([ok("approve"), ok("approve2")].filter(Boolean).length, label).toBeLessThanOrEqual(2);
      expect(await copyProblems(ctx.salon.user.id, id), label).toEqual([]);
      finals[row.status] = (finals[row.status] || 0) + 1;
    }
    note("deadline race finals", JSON.stringify(finals));
    // after everything has settled one more sweep leaves no live, lapsed request behind
    await sweepNow();
    const stuck = (await db.query("SELECT id FROM salon_bookings WHERE salon_user_id = $1 AND status = 'درخواست' AND created_at < NOW() - INTERVAL '60 minutes'", [ctx.salon.user.id])).rows;
    expect(stuck).toEqual([]);
  }, 180_000);

  it("one second after the hour: approve is refused, the slot is free for another client at once, the sweep closes the old one and leaves the new one alone", async () => {
    await clearThrottles(db);
    const ctx = await makeSalon("P1 Deadline Free", { staffCount: 1, services: SERVICES });
    const [a, b] = pool.slice(ROUNDS, ROUNDS + 2);
    const d = day(3);
    const first = await post(a.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "10:00" }));
    expect(first.status).toBe(201);
    const id = first.payload.data.booking.id;
    await ageRequest(id, -1000);
    const approve = await patch(ctx.salonClient, "/api/salon-bookings", { id, status: "تایید شده" });
    expect(approve.status).toBe(409);
    expect(approve.payload.code).toBe("BOOKING_EXPIRED");
    // before any sweep: the single artist is free again for someone else
    const second = await post(b.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "10:00" }));
    expect(second.status, JSON.stringify(second.payload)).toBe(201);
    const swept = await sweepNow();
    expect(swept.status).toBe(200);
    expect((await rowOf(id)).status).toBe("منقضی شده");
    expect((await rowOf(second.payload.data.booking.id)).status).toBe("درخواست");
    expect(await copyProblems(ctx.salon.user.id, id)).toEqual([]);
    expect(await copyProblems(ctx.salon.user.id, second.payload.data.booking.id)).toEqual([]);
    // and the same artist is not double-booked
    const live = (await db.query("SELECT id FROM artist_bookings WHERE source_salon_user_id = $1 AND booking_date = $2 AND status <> ALL($3)", [ctx.salon.user.id, d, DEAD_COPY])).rows;
    expect(live.length).toBe(1);
  }, 60_000);

  it("the hour counts on the wall clock, also overnight (a request sent at the end of the day is dead 61 minutes later, the salon being closed or not)", async () => {
    await clearThrottles(db);
    const ctx = await makeSalon("P1 Overnight", { staffCount: 1, services: SERVICES });
    const [a] = pool.slice(ROUNDS + 2, ROUNDS + 3);
    const d = day(3);
    const made = await post(a.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "10:00" }));
    expect(made.status).toBe(201);
    const id = made.payload.data.booking.id;
    // 59 minutes old: alive; 61 minutes old: dead, however the salon's hours lie
    await ageRequest(id, 60_000);
    expect((await get(a.client, `/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${d}&service=S30`)).payload.data.times.map(ascii)).not.toContain("10:00");
    await ageRequest(id, -60_000);
    // The free-times answer is shared for 5 s (availabilityCache.js); ageing the row by hand bumps nothing.
    await new Promise((resolve) => setTimeout(resolve, 5100));
    const times = (await get(a.client, `/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${d}&service=S30`)).payload.data.times;
    expect(times.map(ascii)).toContain("10:00");
  }, 60_000);

  it("'any time' requests wait 24 hours at most: alive at 23h59m59s, dead at 24h00m01s", async () => {
    await clearThrottles(db);
    const ctx = await makeSalon("P1 AnyTime", { staffCount: 1, services: SERVICES });
    const [a, b] = pool.slice(ROUNDS + 3, ROUNDS + 5);
    const d = day(3);
    const made = await post(a.client, "/api/salon-bookings", { ...slotBody(ctx.salon.user.id, { day: d, time: "10:00" }), waitMinutes: null });
    expect(made.status, JSON.stringify(made.payload)).toBe(201);
    const id = made.payload.data.booking.id;
    expect((await rowOf(id)).wait_minutes).toBeNull();
    await ageRequest(id, 2000, 24 * 60);
    expect((await post(b.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "10:00" }))).status).toBe(409);
    await ageRequest(id, -2000, 24 * 60);
    const approve = await patch(ctx.salonClient, "/api/salon-bookings", { id, status: "تایید شده" });
    expect(approve.status).toBe(409);
    expect((await post(b.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "10:00" }))).status).toBe(201);
    await sweepNow();
    expect((await rowOf(id)).status).toBe("منقضی شده");
  }, 60_000);
});

describe("4e) the slot of a request whose hour is ending: approve, a newcomer and the sweep, all at once", () => {
  it(`${ROUNDS} rounds on a one-artist salon: the artist is never booked twice, and the calendar copies match`, async () => {
    await clearThrottles(db);
    const ctx = await makeSalon("P1 Slot Handover", { staffCount: 1, services: SERVICES });
    // Three different days (ten rounds each): day(n) skips Thursday to the Saturday, which day(n + 1) also is.
    const days = [];
    for (let n = 3; days.length < 3; n += 1) if (!days.includes(day(n))) days.push(day(n));
    const results = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      const a = pool[round];
      const b = pool[(round + ROUNDS) % pool.length];
      for (const x of [a, b]) await db.query("UPDATE salon_bookings SET status = 'لغو' WHERE client_user_id = $1 AND status = 'درخواست'", [x.user.id]);
      await clearThrottles(db);
      const d = days[Math.floor(round / 10)];
      const time = slotTime(round);
      const first = await post(a.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time }));
      expect(first.status, JSON.stringify(first.payload)).toBe(201);
      const idA = first.payload.data.booking.id;
      const left = Math.floor(Math.random() * 70) - 15;
      await ageRequest(idA, left);
      const ops = await Promise.all([
        racer("approveA", () => patch(ctx.salonClient, "/api/salon-bookings", { id: idA, status: "تایید شده" })),
        racer("newB", () => post(b.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time }))),
        racer("sweep", () => sweepNow()),
        racer("cancelA", () => post(a.client, `/api/salon-bookings/${idA}/cancel`, {}))
      ]);
      expect(bad(ops).map((o) => `${o.op} ${o.status}`)).toEqual([]);
      const rowA = await rowOf(idA);
      const label = `round ${round} left=${left}ms ops=${ops.map((o) => `${o.op}:${o.status}`)} A=${rowA.status}`;
      const live = (await db.query("SELECT id, status FROM salon_bookings WHERE salon_user_id = $1 AND booking_date = $2 AND time = $3 AND status <> ALL($4)", [ctx.salon.user.id, d, time, ["لغو", "منقضی شده"]])).rows;
      // one artist, one place: A (confirmed or still open) and B can never both be live
      const bothLive = live.length > 1 && rowA.status !== "منقضی شده";
      expect(bothLive, `${label} live=${JSON.stringify(live)}`).toBe(false);
      expect(await overlapViolations(db, ctx.salon.user.id, d), label).toEqual([]);
      expect(await copyProblems(ctx.salon.user.id, idA), label).toEqual([]);
      results.push(`${rowA.status}/${ops.find((o) => o.op === "newB").status}`);
    }
    note("slot handover (A final / B http)", JSON.stringify(results.reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {})));
    await sweepNow();
    for (let round = 0; round < ROUNDS; round += 1) {
      const d = day(3 + Math.floor(round / 10));
      const live = (await db.query("SELECT id FROM artist_bookings WHERE source_salon_user_id = $1 AND booking_date = $2 AND time = $3 AND status <> ALL($4)", [ctx.salon.user.id, d, slotTime(round), DEAD_COPY])).rows;
      expect(live.length, `calendar copies at round ${round}`).toBeLessThanOrEqual(1);
    }
  }, 240_000);
});

describe("4b) an offered new time (held 6 hours), raced at its last moment", () => {
  async function offered(ctx, client, from, to, d) {
    const made = await post(client.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: from }));
    expect(made.status).toBe(201);
    const id = made.payload.data.booking.id;
    const moved = await patch(ctx.salonClient, "/api/salon-bookings", { id, time: to });
    expect(moved.status, JSON.stringify(moved.payload)).toBe(200);
    expect(moved.payload.data.booking.status).toBe(AWAITING_CLIENT);
    return id;
  }

  it(`${ROUNDS} rounds: accept vs decline vs 2 sweeps vs the salon cancelling, when the 6 hours end within -15..+55 ms of the start`, async () => {
    await clearThrottles(db);
    const ctx = await makeSalon("P1 Offer Salon", { staffCount: 5, services: SERVICES });
    const d = day(3);
    const finals = {};
    for (let round = 0; round < ROUNDS; round += 1) {
      const c = pool[round];
      // the first test left some open requests on these clients; cancel them so the caps do not interfere
      await db.query("UPDATE salon_bookings SET status = 'لغو' WHERE client_user_id = $1 AND status = 'درخواست'", [c.user.id]);
      const id = await offered(ctx, c, slotTime(round), slotTime(round + 8), d);
      const left = Math.floor(Math.random() * 70) - 15;
      await ageOffer(id, left);
      const ops = await Promise.all([
        racer("accept", () => post(c.client, `/api/salon-bookings/${id}/answer`, { accept: true })),
        racer("decline", () => post(c.client, `/api/salon-bookings/${id}/answer`, { accept: false })),
        racer("sweep1", () => sweepNow()),
        racer("sweep2", () => sweepNow()),
        racer("salonCancel", () => patch(ctx.salonClient, "/api/salon-bookings", { id, status: "لغو" }))
      ]);
      expect(bad(ops).map((o) => `${o.op} ${o.status}`)).toEqual([]);
      const row = await rowOf(id);
      const ok = (name) => ops.some((o) => o.op === name && o.status === 200);
      const label = `round ${round} left=${left}ms ops=${ops.map((o) => `${o.op}:${o.status}`)} final=${row.status}`;
      expect(ok("accept") && ok("decline"), `accept and decline both won: ${label}`).toBe(false);
      if (ok("decline") || ok("salonCancel")) expect(row.status, label).toBe("لغو");
      else if (ok("accept")) expect(row.status, label).toBe("تایید شده");
      else expect(["منقضی شده", AWAITING_CLIENT], label).toContain(row.status);
      expect(await copyProblems(ctx.salon.user.id, id), label).toEqual([]);
      finals[row.status] = (finals[row.status] || 0) + 1;
    }
    note("offer race finals", JSON.stringify(finals));
  }, 240_000);

  it("exactly at 6 hours: just inside, the client can still accept; just outside, the answer is refused, the time is free for others and the sweep closes it", async () => {
    await clearThrottles(db);
    const ctx = await makeSalon("P1 Offer Edge", { staffCount: 1, services: SERVICES });
    const [a, b, c2] = pool.slice(ROUNDS, ROUNDS + 3);
    for (const x of [a, b, c2]) await db.query("UPDATE salon_bookings SET status = 'لغو' WHERE client_user_id = $1 AND status = 'درخواست'", [x.user.id]);
    const d = day(3);
    const inside = await offered(ctx, a, "10:00", "12:00", d);
    await ageOffer(inside, 3000);
    const accepted = await post(a.client, `/api/salon-bookings/${inside}/answer`, { accept: true });
    expect(accepted.status, JSON.stringify(accepted.payload)).toBe(200);
    expect((await rowOf(inside)).status).toBe("تایید شده");
    const outside = await offered(ctx, b, "14:00", "16:00", d);
    await ageOffer(outside, -1000);
    const refused = await post(b.client, `/api/salon-bookings/${outside}/answer`, { accept: true });
    expect(refused.status).toBe(409);
    expect(refused.payload.error).toMatch(/تموم شده/);
    // the offered 16:00 is free for someone else before the sweep has run, and the old offer cannot take it back
    const other = await post(c2.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: "16:00" }));
    expect(other.status, JSON.stringify(other.payload)).toBe(201);
    const late = await post(b.client, `/api/salon-bookings/${outside}/answer`, { accept: true });
    expect(late.status).toBe(409);
    await sweepNow();
    expect((await rowOf(outside)).status).toBe("منقضی شده");
    expect((await rowOf(other.payload.data.booking.id)).status).toBe("درخواست");
    expect(await copyProblems(ctx.salon.user.id, outside)).toEqual([]);
    expect(await copyProblems(ctx.salon.user.id, other.payload.data.booking.id)).toEqual([]);
    const live = (await db.query("SELECT time FROM artist_bookings WHERE source_salon_user_id = $1 AND booking_date = $2 AND status <> ALL($3)", [ctx.salon.user.id, d, DEAD_COPY])).rows;
    expect(live.length).toBe(2);
  }, 60_000);
});

describe("4c) a direct artist request: approve vs sweep vs client cancel at the last moment", () => {
  it(`${ROUNDS} rounds`, async () => {
    await clearThrottles(db);
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: `P1 DL Artist ${Math.random().toString(36).slice(2, 7)}` });
    expect((await artistClient.post("/api/artist/me", { name: "ناخن", price: "100", duration: "60 دقیقه" })).ok).toBe(true);
    const d = day(3);
    const finals = {};
    const approveStatuses = {};
    for (let round = 0; round < ROUNDS; round += 1) {
      const c = pool[round];
      await clearThrottles(db);
      await db.query("UPDATE artist_bookings SET status = 'لغو' WHERE client_user_id = $1 AND status = 'تازه'", [c.user.id]);
      const made = await post(c.client, "/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: day(3 + Math.floor(round / 10)), time: slotTime(round) });
      expect(made.status, JSON.stringify(made.payload)).toBe(201);
      const id = made.payload.data.booking.id;
      const left = Math.floor(Math.random() * 70) - 15;
      await db.query("UPDATE artist_bookings SET created_at = NOW() - make_interval(secs => $2::double precision) WHERE id = $1", [id, 3600 - left / 1000]);
      const ops = await Promise.all([
        racer("approve", () => patch(artistClient, "/api/artist/me", { kind: "booking", id, status: "تایید شده" })),
        racer("decline", () => patch(artistClient, "/api/artist/me", { kind: "booking", id, status: "لغو" })),
        racer("sweep1", () => sweepNow()),
        racer("sweep2", () => sweepNow()),
        racer("cancel", () => post(c.client, `/api/artist-bookings/${id}/cancel`, {}))
      ]);
      expect(bad(ops).map((o) => `${o.op} ${o.status}`)).toEqual([]);
      const row = (await db.query("SELECT status FROM artist_bookings WHERE id = $1", [id])).rows[0];
      const ok = (name) => ops.some((o) => o.op === name && o.status === 200);
      const label = `round ${round} left=${left}ms ops=${ops.map((o) => `${o.op}:${o.status}`)} final=${row.status}`;
      expect(ok("approve") && ok("decline") && false).toBe(false);
      if (ok("cancel") || ok("decline")) expect(["لغو", "لغو شده", "cancelled"], label).toContain(row.status);
      else if (ok("approve")) expect(row.status, label).toBe("تایید شده");
      else expect(["منقضی شده", "تازه"], label).toContain(row.status);
      // approved and then expired is the thing that must never happen
      if (ok("approve")) expect(row.status, label).not.toBe("منقضی شده");
      finals[row.status] = (finals[row.status] || 0) + 1;
      const ap = ops.find((o) => o.op === "approve");
      approveStatuses[`${ap.status}${ap.payload?.code ? `/${ap.payload.code}` : ""}`] = (approveStatuses[`${ap.status}${ap.payload?.code ? `/${ap.payload.code}` : ""}`] || 0) + 1;
    }
    note("artist race finals", JSON.stringify(finals), "approve answers", JSON.stringify(approveStatuses));
  }, 240_000);
});

describe("4d) sweeps racing each other and the creators", () => {
  it("5 sweeps at once over 25 lapsed requests while 25 new ones come in: every old one closed exactly once, new ones untouched, no 5xx", async () => {
    await clearThrottles(db);
    const ctx = await makeSalon("P1 Sweep Storm", { staffCount: 4, services: SERVICES });
    const olds = await makeClients(25, "P1 SwOld");
    const news = await makeClients(25, "P1 SwNew");
    const d = day(4);
    const times = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"];
    const ids = [];
    for (let i = 0; i < olds.length; i += 1) {
      const made = await post(olds[i].client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: times[i % 8], extra: {} }));
      if (made.status === 201) ids.push(made.payload.data.booking.id);
    }
    expect(ids.length).toBeGreaterThan(0);
    await db.query("UPDATE salon_bookings SET created_at = NOW() - INTERVAL '2 hours' WHERE id = ANY($1)", [ids]);
    const before = (await db.query("SELECT COUNT(*)::int n FROM sms_log")).rows[0].n;
    const ops = await Promise.all([
      ...Array.from({ length: 5 }, async () => { await jitter(30); return { op: "sweep", ...(await sweepNow()) }; }),
      ...news.map(async (c, i) => { await jitter(80); return { op: "new", ...(await post(c.client, "/api/salon-bookings", slotBody(ctx.salon.user.id, { day: d, time: times[(i + 3) % 8] }))) }; })
    ]);
    expect(bad(ops).map((o) => `${o.op} ${o.status}`)).toEqual([]);
    note("sweep storm", JSON.stringify(tally(ops.filter((o) => o.op === "new"))), "sweep results", JSON.stringify(ops.filter((o) => o.op === "sweep").map((o) => o.data?.salonExpired)));
    const rows = (await db.query("SELECT id, status FROM salon_bookings WHERE id = ANY($1)", [ids])).rows;
    expect(rows.every((r) => r.status === "منقضی شده"), JSON.stringify(rows)).toBe(true);
    // the total reported by all sweeps equals the number of old requests (each closed once); other tests' leftovers may add to it
    const reported = ops.filter((o) => o.op === "sweep").reduce((a, o) => a + (o.data?.salonExpired || 0), 0);
    expect(reported).toBeGreaterThanOrEqual(ids.length);
    for (const id of ids) expect(await copyProblems(ctx.salon.user.id, id)).toEqual([]);
    void before;
    const fresh = (await db.query("SELECT status FROM salon_bookings WHERE salon_user_id = $1 AND client_user_id = ANY($2)", [ctx.salon.user.id, news.map((n) => Number(n.user.id))])).rows;
    expect(fresh.every((r) => r.status === "درخواست")).toBe(true);
  }, 180_000);
});
