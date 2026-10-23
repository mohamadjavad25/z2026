import { describe, it, expect } from "vitest";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { bookingStartMs } from "../../app/shared/lib/reminderTiming.js";
import { openDb } from "./afterVisitKit.js";

async function sweep(now) {
  const res = await fetch(`${TEST_BASE_URL}/api/cron/send-reminders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TEST_CRON_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ now: now.toISOString() })
  });
  return { status: res.status, body: (await res.json()).data };
}

async function confirmedBooking({ time, remindersOn = true }) {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", menu: true, name: "Reminder Salon" });
  await salonClient.get("/api/salon-hours");
  const clientApi = createClient();
  const booker = await registerUser(clientApi, { type: "client", name: "Reminder Client" });
  if (!remindersOn) await clientApi.post("/api/profile/settings", { settings: { reminders: false } });
  const day = futureBookingDay(2);
  const created = await clientApi.post("/api/salon-bookings", {
    salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: day, time,
    client: booker.user.name, phone: booker.phone
  });
  expect(created.ok).toBe(true);
  const confirmed = await salonClient.patch("/api/salon-bookings", { id: created.payload.data.booking.id, status: "تایید شده" });
  expect(confirmed.ok).toBe(true);
  return { day, start: bookingStartMs(day, time, new Date()), id: created.payload.data.booking.id, salonClient, clientApi, clientPhone: booker.phone };
}

describe("booking reminders", () => {
  it("rejects a sweep without the cron secret", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/cron/send-reminders`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("claims a due reminder once, and never again on the next sweep", async () => {
    const { start } = await confirmedBooking({ time: "12:00" });
    const justBefore = new Date(start - 90 * 60000); // 1.5h before -> "soon"
    const first = await sweep(justBefore);
    expect(first.status).toBe(200);
    expect(first.body.claimed).toBeGreaterThanOrEqual(1);
    const second = await sweep(justBefore);
    expect(second.body.claimed).toBe(0);
  });

  it("reminds again when the booking moves to a new time", async () => {
    const db = openDb();
    const sent = async () => (await db.query("SELECT kind FROM booking_reminders WHERE source = 'salon' AND booking_id = $1 ORDER BY sent_at", [id])).rows.map((row) => row.kind);
    const { start, id, salonClient, clientApi } = await confirmedBooking({ time: "14:00" });
    await sweep(new Date(start - 20 * 3600e3));
    expect(await sent()).toHaveLength(1);
    // The salon proposes another day (a confirmed visit only moves once the client accepts), the client takes it.
    const newDay = futureBookingDay(4);
    expect((await salonClient.post("/api/booking-proposals", { kind: "salon", id, date: newDay, time: "15:00" })).ok).toBe(true);
    expect((await clientApi.post("/api/booking-proposals/answer", { kind: "salon", id, action: "accept" })).ok).toBe(true);
    const newStart = bookingStartMs(newDay, "15:00", new Date());
    await sweep(new Date(newStart - 20 * 3600e3));
    await sweep(new Date(newStart - 20 * 3600e3));
    const kinds = await sent();
    await db.end();
    expect(kinds).toHaveLength(2);
    expect(kinds[1]).toBe(`day@${newDay} 15:00`);
  });

  it("keeps the day-before reminder for the morning, and texts the two-hour one to a client no push reaches", async () => {
    const db = openDb();
    const { start, id, clientPhone } = await confirmedBooking({ time: "11:00" });
    const kinds = async () => (await db.query("SELECT kind FROM booking_reminders WHERE source = 'salon' AND booking_id = $1", [id])).rows.map((row) => row.kind);
    // 23:00 Tehran the night before (12h before an 11:00 visit): nothing yet.
    await sweep(new Date(start - 12 * 3600e3));
    expect(await kinds()).toEqual([]);
    // 08:00 Tehran: the day-before reminder goes.
    await sweep(new Date(start - 3 * 3600e3));
    expect((await kinds())[0]).toMatch(/^day@/);
    // Two hours before: this client has no notifications at all, so it also comes as an SMS.
    await sweep(new Date(start - 90 * 60000));
    let texts = [];
    for (let i = 0; i < 20 && !texts.length; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      texts = (await db.query("SELECT body FROM sms_log WHERE phone = $1 AND purpose = 'booking_reminder'", [clientPhone])).rows.map((row) => row.body);
    }
    await db.end();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("۱۱:۰۰");
  });

  it("skips clients who turned reminders off", async () => {
    const { start } = await confirmedBooking({ time: "13:00", remindersOn: false });
    const result = await sweep(new Date(start - 90 * 60000));
    expect(result.body.skipped).toBeGreaterThanOrEqual(1);
  });

  it("sends nothing for a booking that is not confirmed", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", menu: true, name: "Pending Salon" });
    await salonClient.get("/api/salon-hours");
    const clientApi = createClient();
    const booker = await registerUser(clientApi, { type: "client" });
    const day = futureBookingDay(2);
    const created = await clientApi.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: day, time: "16:00", client: booker.user.name, phone: booker.phone
    });
    expect(created.ok).toBe(true); // stays "درخواست"
    const start = bookingStartMs(day, "16:00", new Date());
    const before = await sweep(new Date(start - 90 * 60000));
    const again = await sweep(new Date(start - 90 * 60000));
    expect(again.body.claimed).toBe(0);
    expect(before.status).toBe(200);
  });
});
