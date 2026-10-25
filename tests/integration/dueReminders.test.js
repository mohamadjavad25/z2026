import { describe, it, expect, afterAll } from "vitest";
import { confirmSalon, moveToDaysAgo, newClient, newSalon, openDb, reminderSweep, requestSalon } from "./afterVisitKit.js";
import { futureBookingDay } from "./helpers.js";

/** «وقتش شده» (owner's decisions of 2026-10-25): one push after the usual gap, only once the salon has confirmed. */
const db = openDb();
afterAll(() => db.end());

/** Today at 12:00 Tehran (the sweep only sends between 10:00 and 20:00). */
function tehranNoon() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 30));
}

const sentFor = async (id) => (await db.query("SELECT 1 FROM due_reminders_sent WHERE booking_kind = 'salon' AND booking_id = $1", [id])).rowCount;

async function pastVisit(name, daysAgo = 45) {
  const ctx = await newSalon(name);
  const client = await newClient(`C ${name}`);
  const booking = (await requestSalon(ctx, client)).payload.data.booking; // «کوتاهی مو»: usually every 6 weeks
  expect((await confirmSalon(ctx, booking.id)).ok).toBe(true);
  await moveToDaysAgo(db, "salon_bookings", booking.id, daysAgo);
  return { ctx, client, booking };
}

describe("«وقتش شده»", () => {
  it("nothing until the salon confirms; then exactly one push", async () => {
    const { ctx, booking } = await pastVisit("Due");
    const plan = (await ctx.salonClient.get("/api/due-reminders")).payload.data;
    expect(plan.confirmed).toBe(false);
    expect(plan.services.find((s) => s.name === "کوتاهی مو").gapDays).toBe(42);
    await reminderSweep(tehranNoon());
    expect(await sentFor(booking.id)).toBe(0);
    expect((await ctx.salonClient.post("/api/due-reminders", { confirm: true })).payload.data.confirmed).toBe(true);
    await reminderSweep(tehranNoon());
    await reminderSweep(tehranNoon());
    expect(await sentFor(booking.id)).toBe(1);
  });

  it("not when the client already has a later booking there, has switched it off, or the salon turned the service off", async () => {
    const later = await pastVisit("DueLater");
    await later.ctx.salonClient.post("/api/due-reminders", { confirm: true });
    expect((await requestSalon(later.ctx, later.client, { day: futureBookingDay(3) })).ok).toBe(true);

    const off = await pastVisit("DueOff");
    await off.ctx.salonClient.post("/api/due-reminders", { confirm: true });
    expect((await off.client.api.post("/api/profile/settings", { settings: { dueReminders: false } })).ok).toBe(true);

    const svcOff = await pastVisit("DueSvcOff");
    const saved = await svcOff.ctx.salonClient.post("/api/due-reminders", { service: "کوتاهی مو", gapDays: 0, textId: "a" });
    expect(saved.ok, JSON.stringify(saved.payload)).toBe(true);

    await reminderSweep(tehranNoon());
    expect(await sentFor(later.booking.id)).toBe(0);
    expect(await sentFor(off.booking.id)).toBe(0);
    expect(await sentFor(svcOff.booking.id)).toBe(0);
  });

  it("the salon's own text is checked: not empty, at most 80 letters, only for its own services", async () => {
    const ctx = await newSalon("DueText");
    expect((await ctx.salonClient.post("/api/due-reminders", { service: "کوتاهی مو", gapDays: 42, textId: "custom", customText: "" })).status).toBe(400);
    expect((await ctx.salonClient.post("/api/due-reminders", { service: "کوتاهی مو", gapDays: 42, textId: "custom", customText: "ا".repeat(81) })).status).toBe(400);
    expect((await ctx.salonClient.post("/api/due-reminders", { service: "چیزی که نیست", gapDays: 42, textId: "a" })).status).toBe(400);
    const ok = await ctx.salonClient.post("/api/due-reminders", { service: "کوتاهی مو", gapDays: 35, textId: "custom", customText: "وقت مو کوتاه کردنه" });
    expect(ok.ok).toBe(true);
    const rule = ok.payload.data.services.find((s) => s.name === "کوتاهی مو");
    expect(rule).toMatchObject({ gapDays: 35, textId: "custom", customText: "وقت مو کوتاه کردنه" });
    expect(ok.payload.data.confirmed).toBe(true);
  });

  it("a client can't use the salon's page", async () => {
    const client = await newClient("C DueNo");
    expect((await client.api.get("/api/due-reminders")).status).toBe(403);
  });
});
