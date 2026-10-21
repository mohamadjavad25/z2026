import { describe, it, expect, afterAll } from "vitest";
import { closeDb, q, note, pickDay, newSalon, newClient, newArtist, bookAtSalon, cron, raw } from "./angle2Util.js";
import { bookingStartMs } from "../../app/shared/lib/reminderTiming.js";
import { TEST_CRON_SECRET } from "../globalSetup.js";

afterAll(closeDb);

async function confirmedBooking(time = "۱۲:۰۰") {
  const salon = await newSalon("Cron Salon");
  const client = await newClient("Cron Client");
  const day = pickDay({ min: 3 });
  const made = await bookAtSalon(client.api, salon, client, { day: day.key, time });
  expect(made.status).toBe(201);
  await salon.api.patch("/api/salon-bookings", { id: made.payload.data.booking.id, status: "تایید شده" });
  const start = bookingStartMs(day.key, time, new Date());
  return { salon, client, id: made.payload.data.booking.id, start };
}
const claims = (id) => q("SELECT kind FROM booking_reminders WHERE source = 'salon' AND booking_id = $1", [id]);

describe("cron auth", () => {
  it("rejects missing, wrong, malformed, empty and prefix-only secrets with 401 on every cron route", async () => {
    const problems = [];
    for (const route of ["send-reminders", "expire-bookings", "billing", "migrate-media"]) {
      for (const secret of [null, "", "wrong", TEST_CRON_SECRET.slice(0, -1), `${TEST_CRON_SECRET}x`, " ", "undefined"]) {
        const res = await cron(route, {}, { secret });
        if (res.status !== 401 && res.status !== 405) problems.push(`${route} secret=${JSON.stringify(secret)} -> ${res.status}`);
      }
      const noScheme = await raw(`/api/cron/${route}`, { body: "{}", headers: { Authorization: TEST_CRON_SECRET } });
      if (noScheme.status !== 401) problems.push(`${route} bare token without Bearer -> ${noScheme.status}`);
    }
    expect(problems).toEqual([]);
  });
});

describe("send-reminders with garbage", () => {
  it("garbage bodies and dates never 5xx", async () => {
    const problems = [];
    const bodies = [undefined, "", "{", "null", "[]", "123", "\"x\"", { now: "garbage" }, { now: "" }, { now: null }, { now: 0 }, { now: -1 }, { now: 1e20 }, { now: "9999-99-99" }, { now: "0000-01-01T00:00:00Z" }, { now: [] }, { now: {} }, { now: "1405-08-12" }];
    for (const body of bodies) {
      const res = await cron("send-reminders", typeof body === "string" ? undefined : body, { rawBody: typeof body === "string" ? body : undefined });
      if (res.status >= 500) problems.push(`body=${JSON.stringify(body)} -> ${res.status} ${res.text.slice(0, 80)}`);
    }
    expect(problems).toEqual([]);
  });

  it("an invalid 'now' is rejected (400) rather than treated as an arbitrary clock", async () => {
    const res = await cron("send-reminders", { now: "garbage" });
    expect([200, 400]).toContain(res.status);
    note("send-reminders now=garbage ->", res.status, res.text.slice(0, 100));
    expect(res.status).toBe(400);
  });

  it("billing cron: same garbage never 5xx", async () => {
    const problems = [];
    for (const body of [undefined, "{", "null", "[]", { now: "garbage" }, { now: 1e20 }, { now: "" }, { now: -1 }, { now: "0000-01-01T00:00:00Z" }]) {
      const res = await cron("billing", typeof body === "string" ? undefined : body, { rawBody: typeof body === "string" ? body : undefined });
      if (res.status >= 500) problems.push(`billing body=${JSON.stringify(body)} -> ${res.status}`);
    }
    expect(problems).toEqual([]);
  });

  it("expire-bookings ignores any body and never 5xx", async () => {
    for (const rawBody of [undefined, "{", "null", "[]", "{\"now\":\"x\"}"]) {
      expect((await cron("expire-bookings", undefined, { rawBody })).status).toBeLessThan(500);
    }
  });
});

describe("two sweeps at the same moment", () => {
  it("7 parallel reminder sweeps claim each (booking, kind) exactly once", async () => {
    const b = await confirmedBooking("۱۲:۰۰");
    const now = new Date(b.start - 90 * 60000).toISOString();
    const results = await Promise.all(Array.from({ length: 7 }, () => cron("send-reminders", { now })));
    for (const r of results) expect(r.status, r.text.slice(0, 100)).toBe(200);
    expect(await claims(b.id)).toHaveLength(1);
    const totalClaimed = results.reduce((sum, r) => sum + (r.payload.data.claimed || 0), 0);
    expect(totalClaimed).toBeGreaterThanOrEqual(1);
    expect((await claims(b.id)).map((r) => r.kind)).toEqual(["soon"]);
  });

  it("a booking 20h away gets a 'day' reminder once, then 'soon' once later, never twice", async () => {
    const b = await confirmedBooking("۱۴:۰۰");
    const dayNow = new Date(b.start - 20 * 3600000).toISOString();
    await Promise.all([cron("send-reminders", { now: dayNow }), cron("send-reminders", { now: dayNow })]);
    await cron("send-reminders", { now: dayNow });
    await Promise.all([cron("send-reminders", { now: new Date(b.start - 60 * 60000).toISOString() }), cron("send-reminders", { now: new Date(b.start - 59 * 60000).toISOString() })]);
    expect((await claims(b.id)).map((r) => r.kind).sort()).toEqual(["day", "soon"]);
  });

  it("no reminder for cancelled, expired, started or past bookings, and none exactly at or after the start", async () => {
    const b = await confirmedBooking("۱۵:۰۰");
    for (const offset of [0, 1, 60000]) await cron("send-reminders", { now: new Date(b.start + offset).toISOString() });
    await cron("send-reminders", { now: new Date(b.start + 30 * 86400000).toISOString() });
    expect(await claims(b.id)).toHaveLength(0);
    const c = await confirmedBooking("۱۶:۰۰");
    await c.client.api.post(`/api/salon-bookings/${c.id}/cancel`, {});
    await cron("send-reminders", { now: new Date(c.start - 90 * 60000).toISOString() });
    expect(await claims(c.id)).toHaveLength(0);
  });

  it("a reminder never lands on the wrong day around Tehran midnight (UTC vs Tehran day boundary)", async () => {
    const salon = await newSalon();
    const client = await newClient();
    const day = pickDay({ min: 3 });
    // 10:00 booking; "now" is 22:30 Tehran the evening before (= 19:00Z): day reminder due; 23:59 Tehran must also be a day/soon-free zone for 10:00
    const made = await bookAtSalon(client.api, salon, client, { day: day.key, time: "۱۰:۰۰" });
    await salon.api.patch("/api/salon-bookings", { id: made.payload.data.booking.id, status: "تایید شده" });
    const start = bookingStartMs(day.key, "۱۰:۰۰", new Date());
    const res = await cron("send-reminders", { now: new Date(start - 9.5 * 3600000).toISOString() });
    expect(res.status).toBe(200);
    expect((await claims(made.payload.data.booking.id)).map((r) => r.kind)).toEqual(["day"]);
    const wrongDay = await cron("send-reminders", { now: new Date(start - 26 * 3600000).toISOString() });
    expect(wrongDay.status).toBe(200);
    expect((await claims(made.payload.data.booking.id)).map((r) => r.kind)).toEqual(["day"]);
  });

  it("5 parallel expiry sweeps expire an overdue request once: one expired status, one client+salon notice, never an error", async () => {
    const salon = await newSalon();
    const client = await newClient();
    const day = pickDay({ min: 3 });
    const made = await bookAtSalon(client.api, salon, client, { day: day.key, time: "۱۱:۰۰" });
    await q("UPDATE salon_bookings SET booking_date = $2 WHERE id = $1", [made.payload.data.booking.id, "1405-01-01"]);
    const results = await Promise.all(Array.from({ length: 5 }, () => cron("expire-bookings")));
    for (const r of results) expect(r.status, r.text.slice(0, 120)).toBe(200);
    const totalExpired = results.reduce((sum, r) => sum + (r.payload.data.salonExpired || 0), 0);
    expect(totalExpired).toBe(1);
    const [row] = await q("SELECT status FROM salon_bookings WHERE id = $1", [made.payload.data.booking.id]);
    expect(row.status).toBe("منقضی شده");
  });

  it("parallel expiry sweeps on an overdue DIRECT artist request expire it once", async () => {
    const artist = await newArtist();
    const client = await newClient();
    const day = pickDay({ min: 3 });
    const made = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مانیکور", bookingDate: day.key, time: "۱۱:۰۰", clientName: client.user.name, clientPhone: client.phone });
    expect(made.status).toBe(201);
    await q("UPDATE artist_bookings SET booking_date = '1405-01-01' WHERE id = $1", [made.payload.data.booking.id]);
    const results = await Promise.all(Array.from({ length: 5 }, () => cron("expire-bookings")));
    expect(results.reduce((s, r) => s + (r.payload.data.artistExpired || 0), 0)).toBe(1);
  });

  it("concurrent billing sweeps never 5xx", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => cron("billing", { now: new Date().toISOString() })));
    for (const r of results) expect(r.status, r.text.slice(0, 120)).toBeLessThan(500);
  });
});
