import { describe, it, expect } from "vitest";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { bookingStartMs } from "../../app/shared/lib/reminderTiming.js";

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
  const salon = await registerUser(salonClient, { type: "salon", name: "Reminder Salon" });
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
  return { day, start: bookingStartMs(day, time, new Date()) };
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

  it("skips clients who turned reminders off", async () => {
    const { start } = await confirmedBooking({ time: "13:00", remindersOn: false });
    const result = await sweep(new Date(start - 90 * 60000));
    expect(result.body.skipped).toBeGreaterThanOrEqual(1);
  });

  it("sends nothing for a booking that is not confirmed", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Pending Salon" });
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
