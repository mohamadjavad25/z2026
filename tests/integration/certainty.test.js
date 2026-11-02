import { describe, it, expect } from "vitest";
import { futureBookingDay } from "./helpers.js";
import {
  cancelByClient, confirmSalon, moveBooking, moveToDaysAgo, newClient, newSalon, openDb, requestSalon, reminderSweep, salonRow
} from "./afterVisitKit.js";
import { bookingStartMs } from "../../app/shared/lib/reminderTiming.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { toLatinDigits } from "../../app/shared/lib/digits.js";

/**
 * «اطمینان بدون بیعانه» (owner's decision of 2026-10-27): «میای؟» the day before, the client's record across frfro,
 * and «خبرم کن» for a full day.
 */

/** A date key and "HH:MM" (Tehran) about `hours` from now, as the app reads them. */
function slotHoursAhead(hours) {
  const target = Date.now() + hours * 3600e3;
  const minutes = (Math.floor(target / 60000) + 210) % 1440;
  const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  for (const shift of [-1, 0, 1]) {
    const date = formatPersianDateKey(new Date(target + shift * 86400e3));
    const start = bookingStartMs(date, time, new Date());
    if (start !== null && Math.abs(start - target) < 60000) return { date, time };
  }
  throw new Error("could not place a slot");
}

async function confirmedVisit(ctx, who, opts) {
  const made = await requestSalon(ctx, who, opts);
  expect(made.ok).toBe(true);
  const id = made.payload.data.booking.id;
  expect((await confirmSalon(ctx, id)).ok).toBe(true);
  return id;
}

const attend = (who, id, kind = "salon") => who.api.post("/api/booking-attend", { kind, id });

describe("«میای؟»", () => {
  it("is answered only in the last day before a confirmed visit, by its own client", async () => {
    const db = openDb();
    const ctx = await newSalon("Attend");
    const who = await newClient("Attend Client");
    const other = await newClient("Other Client");
    const id = await confirmedVisit(ctx, who, { day: futureBookingDay(3), time: "11:00" });

    // Three days ahead: not asked yet.
    const early = await attend(who, id);
    expect(early.status).toBe(409);

    await moveBooking(db, "salon_bookings", id, slotHoursAhead(5));
    expect((await attend(other, id)).status).toBe(404);
    const yes = await attend(who, id);
    expect(yes.ok).toBe(true);
    expect(yes.payload.data.changed).toBe(true);
    const again = await attend(who, id);
    expect(again.payload.data.changed).toBe(false);

    // The salon sees the answer on the booking; the client's own list carries it too.
    expect((await salonRow(ctx, id)).client_confirmed_at).toBeTruthy();
    const mine = (await who.api.get("/api/client-bookings")).payload.data.salonBookings.find((b) => b.id === id);
    expect(mine.client_confirmed_at).toBeTruthy();
    await db.end();
  });

  it("the day-before reminder asks the question", async () => {
    const db = openDb();
    const ctx = await newSalon("Ask");
    const who = await newClient("Ask Client");
    const day = futureBookingDay(2);
    const id = await confirmedVisit(ctx, who, { day, time: "14:00" });
    const start = bookingStartMs(day, "14:00", new Date());
    await reminderSweep(new Date(start - 5 * 3600e3));
    const sent = await db.query("SELECT kind FROM booking_reminders WHERE source = 'salon' AND booking_id = $1", [id]);
    expect(sent.rows[0].kind).toMatch(/^day@/);
    await db.end();
  });
});

describe("the client's record", () => {
  it("counts visits and «نیومد» across salons, and shows it to the salon and the client", async () => {
    const db = openDb();
    const a = await newSalon("Record A");
    const b = await newSalon("Record B");
    const who = await newClient("Record Client");
    const came = await confirmedVisit(a, who, { day: futureBookingDay(2), time: "10:00" });
    const missed = await confirmedVisit(b, who, { day: futureBookingDay(2), time: "12:00" });
    const missed2 = await confirmedVisit(b, who, { day: futureBookingDay(3), time: "12:00" });
    await moveToDaysAgo(db, "salon_bookings", came, 10);
    await moveToDaysAgo(db, "salon_bookings", missed, 9);
    await moveToDaysAgo(db, "salon_bookings", missed2, 8);
    await db.query("UPDATE salon_bookings SET no_show_at = NOW() - INTERVAL '8 days' WHERE id = ANY($1::int[])", [[missed, missed2]]);

    // A new request at salon A: A sees the record built at B too.
    const next = await requestSalon(a, who, { day: futureBookingDay(4), time: "16:00" });
    const row = await salonRow(a, next.payload.data.booking.id);
    expect(row.reliability).toEqual({ came: 1, noShow: 2, recentNoShow: 2 });

    const own = (await who.api.get("/api/client-bookings")).payload.data.reliability;
    expect(own).toEqual({ came: 1, noShow: 2, recentNoShow: 2 });
    await db.end();
  });
});

describe("«خبرم کن»", () => {
  it("tells a waiting client when a time opens on that day, once", async () => {
    const db = openDb();
    const ctx = await newSalon("Wait");
    const first = await newClient("Wait First");
    const waiter = await newClient("Wait Second");
    const day = futureBookingDay(2);
    const id = await confirmedVisit(ctx, first, { day, time: "10:00" });

    const joined = await waiter.api.post("/api/waitlist", {
      kind: "salon", ownerId: ctx.id, day, services: [{ name: "کوتاهی مو", minutes: 60 }]
    });
    expect(joined.status).toBe(201);
    expect(joined.payload.data.entries).toHaveLength(1);
    const entryId = joined.payload.data.entry.id;
    // 10:00 is taken, so it is not among what was free when they asked.
    expect(joined.payload.data.freeNow.map(toLatinDigits)).not.toContain("10:00");

    expect((await cancelByClient(first, "salon_bookings", id)).ok).toBe(true);
    let notified = null;
    for (let i = 0; i < 20 && !notified; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      notified = (await db.query("SELECT notified_at, free_signature FROM booking_waitlist WHERE id = $1", [entryId])).rows[0]?.notified_at;
    }
    expect(notified).toBeTruthy();
    const after = (await db.query("SELECT free_signature FROM booking_waitlist WHERE id = $1", [entryId])).rows[0];
    expect(toLatinDigits(after.free_signature).split(",")).toContain("10:00");

    // The same opening is not announced twice by the scheduler.
    await reminderSweep();
    const again = (await db.query("SELECT notified_at FROM booking_waitlist WHERE id = $1", [entryId])).rows[0].notified_at;
    expect(new Date(again).getTime()).toBe(new Date(notified).getTime());

    // The client's home lists it, and it can be taken away.
    expect((await waiter.api.get("/api/client-bookings")).payload.data.waitlist.map((e) => e.id)).toContain(entryId);
    const removed = await waiter.api.delete(`/api/waitlist?id=${entryId}`);
    expect(removed.ok).toBe(true);
    expect(removed.payload.data.entries).toHaveLength(0);
    await db.end();
  });

  it("is for clients only, within the booking horizon, and a few at a time", async () => {
    const ctx = await newSalon("Wait Limits");
    const who = await newClient("Wait Limits Client");
    const services = [{ name: "کوتاهی مو", minutes: 60 }];
    expect((await ctx.salonClient.post("/api/waitlist", { kind: "salon", ownerId: ctx.id, day: futureBookingDay(2), services })).status).toBe(403);
    expect((await who.api.post("/api/waitlist", { kind: "artist", ownerId: ctx.id, day: futureBookingDay(2), services })).status).toBe(409);
    expect((await who.api.post("/api/waitlist", { kind: "salon", ownerId: ctx.id, day: futureBookingDay(2), services: [] })).status).toBe(400);
    for (let i = 1; i <= 5; i += 1) {
      expect((await who.api.post("/api/waitlist", { kind: "salon", ownerId: ctx.id, day: futureBookingDay(i), services })).status).toBe(201);
    }
    expect((await who.api.post("/api/waitlist", { kind: "salon", ownerId: ctx.id, day: futureBookingDay(6), services })).status).toBe(409);
    // Asking again for a day already on the list just renews it.
    expect((await who.api.post("/api/waitlist", { kind: "salon", ownerId: ctx.id, day: futureBookingDay(1), services })).status).toBe(201);
  });

});
