import { describe, it, expect, afterAll } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, uniquePhone } from "./helpers.js";
import { FAR_DAY, newArtist, newClient, newSalon, q, smsEventually, smsSettled } from "./exitHelpers.js";
import { moveToDaysAgo, openDb, reminderSweep } from "./afterVisitKit.js";
import { bookingStartMs } from "../../app/shared/lib/reminderTiming.js";
import { providerLinkCode } from "../../app/shared/lib/providerLink.js";

/**
 * Owner's decisions of 2026-11-09: a booking a salon or artist enters by hand gets real follow-up. Bug found on the live
 * site that day: all nine artist bookings were hand-entered, and every reminder sweep skipped them for having no account.
 */
const db = openDb();
afterAll(() => db.end());

const salonEntry = async (salon, { phone, day = FAR_DAY(3), time = "11:00" }) => {
  const made = await salon.api.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: day, time, client: "مشتری دستی", phone });
  expect(made.status).toBe(201);
  return { id: made.payload.data.booking.id, day, time, start: bookingStartMs(day, time, new Date()) };
};
const artistEntry = async (artist, { phone, day = FAR_DAY(3), time = "11:00" }) => {
  const made = await artist.api.post("/api/artist/me", { kind: "booking", service: "کوتاهی مو", date: day, time, client: "مشتری دستی", phone, durationMinutes: 60 });
  expect(made.status).toBe(201);
  return { id: made.payload.data.booking.id, day, time, start: bookingStartMs(day, time, new Date()) };
};
const reminders = ["booking_reminder"];
const minutesBefore = (start, minutes) => new Date(start - minutes * 60000);
const verify = (phone) => q("UPDATE users SET phone_verified_at = NOW() WHERE phone = $1", [phone]);

describe("a number entered by hand gets the two-hour reminder", () => {
  it("salon entry: one SMS, however many sweeps", async () => {
    const salon = await newSalon("Hand Reminder Salon");
    const phone = uniquePhone();
    const { start } = await salonEntry(salon, { phone });
    await reminderSweep(minutesBefore(start, 90));
    await reminderSweep(minutesBefore(start, 80));
    const texts = await smsEventually(phone, "booking_reminder", 1);
    expect(texts[0].body).toContain(salon.user.name);
    expect(await smsSettled(phone, reminders)).toBe(1);
  });

  it("artist entry: one SMS", async () => {
    const artist = await newArtist("Hand Reminder Artist");
    const phone = uniquePhone();
    const { start } = await artistEntry(artist, { phone, time: "12:00" });
    await reminderSweep(minutesBefore(start, 90));
    expect(await smsEventually(phone, "booking_reminder", 1)).toHaveLength(1);
  });

  it("no SMS the day before", async () => {
    const salon = await newSalon("Hand Day Salon");
    const phone = uniquePhone();
    const { start } = await salonEntry(salon, { phone, time: "14:00" });
    await reminderSweep(minutesBefore(start, 20 * 60));
    expect(await smsSettled(phone, reminders)).toBe(0);
  });

  it("waits for 08:00: nothing at 07:00 for an 08:30 visit, one text at 08:10", async () => {
    const salon = await newSalon("Hand Early Salon");
    const phone = uniquePhone();
    const { id, day } = await salonEntry(salon, { phone, time: "11:00" }); // inside the salon's hours; the visit then moves early
    await q("UPDATE salon_bookings SET time = '08:30' WHERE id = $1", [id]);
    const start = bookingStartMs(day, "08:30", new Date());
    await reminderSweep(minutesBefore(start, 90));
    expect(await smsSettled(phone, reminders)).toBe(0);
    await reminderSweep(minutesBefore(start, 20));
    expect(await smsEventually(phone, "booking_reminder", 1)).toHaveLength(1);
  });

  it("not for a visit entered less than two hours ahead", async () => {
    const salon = await newSalon("Hand Late Salon");
    const phone = uniquePhone();
    const { id, start } = await salonEntry(salon, { phone, time: "15:00" });
    await q("UPDATE salon_bookings SET created_at = $2 WHERE id = $1", [id, minutesBefore(start, 60)]);
    await reminderSweep(minutesBefore(start, 45));
    expect(await smsSettled(phone, reminders)).toBe(0);
  });

  it("not for the provider's own number, nor when the provider switched reminders off", async () => {
    const own = await newSalon("Hand Own Salon");
    const self = await salonEntry(own, { phone: own.phone, time: "16:00" });
    await reminderSweep(minutesBefore(self.start, 90));
    expect(await smsSettled(own.phone, reminders)).toBe(0);

    const off = await newSalon("Hand Off Salon");
    expect((await off.api.post("/api/profile/settings", { settings: { reminders: false } })).ok).toBe(true);
    const phone = uniquePhone();
    const { start } = await salonEntry(off, { phone, time: "17:00" });
    await reminderSweep(minutesBefore(start, 90));
    expect(await smsSettled(phone, reminders)).toBe(0);
  });
});

describe("a number an account has proven counts as that account", () => {
  const kinds = async (id) => (await q("SELECT kind FROM booking_reminders WHERE source = 'salon' AND booking_id = $1", [id])).map((row) => row.kind);

  it("verified: gets the day-before one too; unverified: does not", async () => {
    const salon = await newSalon("Hand Verified Salon");
    const proven = await newClient("Proven Client");
    await verify(proven.phone);
    const claimed = await newClient("Unproven Client");
    await q("UPDATE users SET phone_verified_at = NULL WHERE phone = $1", [claimed.phone]);
    const a = await salonEntry(salon, { phone: proven.phone, time: "13:00" });
    const b = await salonEntry(salon, { phone: claimed.phone, time: "15:00" });
    await reminderSweep(minutesBefore(a.start, 20 * 60));
    await reminderSweep(minutesBefore(b.start, 20 * 60));
    expect(await kinds(a.id)).toHaveLength(1);
    expect(await kinds(b.id)).toHaveLength(0);
  });

  it("a verified client who switched reminders off gets none", async () => {
    const salon = await newSalon("Hand Quiet Salon");
    const client = await newClient("Quiet Client");
    await verify(client.phone);
    expect((await client.api.post("/api/profile/settings", { settings: { reminders: false } })).ok).toBe(true);
    const { start } = await salonEntry(salon, { phone: client.phone, time: "14:00" });
    await reminderSweep(minutesBefore(start, 90));
    expect(await smsSettled(client.phone, reminders)).toBe(0);
  });

  it("«وقتش شده» goes to a verified account, never to a bare number", async () => {
    const salon = await newSalon("Hand Due Salon");
    const client = await newClient("Hand Due Client");
    await verify(client.phone);
    const bare = uniquePhone();
    expect((await salon.api.post("/api/due-reminders", { confirm: true })).ok).toBe(true);
    const proven = await salonEntry(salon, { phone: client.phone, time: "11:00" });
    const number = await salonEntry(salon, { phone: bare, time: "13:00" });
    await moveToDaysAgo(db, "salon_bookings", proven.id, 45);
    await moveToDaysAgo(db, "salon_bookings", number.id, 45);
    const now = new Date();
    const noon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 30));
    await reminderSweep(noon);
    const sent = await q("SELECT booking_id FROM due_reminders_sent WHERE booking_kind = 'salon' AND booking_id = ANY($1::int[])", [[proven.id, number.id]]);
    expect(sent.map((row) => row.booking_id)).toEqual([proven.id]);
  });
});

describe("when a hand-entered visit is cancelled, the number hears it", () => {
  it("salon: one SMS", async () => {
    const salon = await newSalon("Hand Cancel Salon");
    const phone = uniquePhone();
    const { id } = await salonEntry(salon, { phone });
    expect((await salon.api.patch("/api/salon-bookings", { id, status: "لغو" })).ok).toBe(true);
    expect(await smsEventually(phone, "booking_cancelled_by_provider", 1)).toHaveLength(1);
    expect(await smsSettled(phone, ["booking_cancelled_by_provider"])).toBe(1);
  });

  it("artist: one SMS", async () => {
    const artist = await newArtist("Hand Cancel Artist");
    const phone = uniquePhone();
    const { id } = await artistEntry(artist, { phone });
    expect((await artist.api.patch("/api/artist/me", { kind: "booking", id, status: "لغو" })).ok).toBe(true);
    expect(await smsEventually(phone, "booking_cancelled_by_provider", 1)).toHaveLength(1);
  });

  it("a cancelled visit gets no reminder", async () => {
    const salon = await newSalon("Hand Gone Salon");
    const phone = uniquePhone();
    const { id, start } = await salonEntry(salon, { phone, time: "12:00" });
    await salon.api.patch("/api/salon-bookings", { id, status: "لغو" });
    await reminderSweep(minutesBefore(start, 90));
    expect(await smsSettled(phone, reminders)).toBe(0);
  });
});

describe("what the audit of 2026-11-09 found", () => {
  it("a salon moving a hand-entered visit tells the number the new time, once", async () => {
    const salon = await newSalon("Hand Moved Salon");
    const phone = uniquePhone();
    const { id, day } = await salonEntry(salon, { phone });
    await smsEventually(phone, "booking_made_link", 1);
    expect((await salon.api.patch("/api/salon-bookings", { id, bookingDate: day, time: "13:00" })).ok).toBe(true);
    const texts = await smsEventually(phone, "booking_made_link", 2);
    expect(texts[1].body).toContain("۱۳:۰۰");
    expect(await smsSettled(phone, ["booking_made_link"])).toBe(2);
  });

  it("a hand entry later tied to an account keeps its reminder", async () => {
    const salon = await newSalon("Hand Tied Salon");
    const client = await newClient("Hand Tied Client");
    const { id, start } = await salonEntry(salon, { phone: client.phone, time: "12:00" });
    await q("UPDATE salon_bookings SET client_user_id = $2 WHERE id = $1", [id, client.user.id]);
    await reminderSweep(minutesBefore(start, 90));
    expect(await smsEventually(client.phone, "booking_reminder", 1)).toHaveLength(1);
  });
});

describe("limits the audit of 2026-11-09 asked for", () => {
  it("one number stops getting texts after six a day, whichever accounts type it in", async () => {
    const phone = uniquePhone();
    await q("INSERT INTO rate_limit_hits (key, hit_at) SELECT $1, NOW() FROM generate_series(1, 6)", [`sms-typed-number:${phone}`]);
    const salon = await newSalon("Hand Capped Salon");
    const { id } = await salonEntry(salon, { phone });
    expect(id).toBeTruthy();
    expect(await smsSettled(phone, ["booking_made_link", "booking_made_for_you"])).toBe(0);
  });

  it("a stranger's wrong passwords do not lock the real owner out", async () => {
    const client = await newClient("Lockout Client");
    const attempt = (ip) => fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Real-IP": ip },
      body: JSON.stringify({ phone: client.phone, password: "wrong-password" })
    });
    for (let i = 0; i < 10; i += 1) await attempt("203.0.113.77");
    expect((await attempt("203.0.113.77")).status).toBe(429);
    expect((await attempt("203.0.113.78")).status).toBe(401);
  });

  it("a reset request for a number with no account costs nothing", async () => {
    const phone = uniquePhone();
    const anon = createClient("");
    const asked = await anon.post("/api/auth/password-reset-requests", { phone });
    expect(asked.status).toBe(200);
    expect(asked.payload.data.id).toBe(0);
    expect(await q("SELECT id FROM password_reset_requests WHERE phone = $1", [phone])).toHaveLength(0);
  });
});

describe("the first text carries the link to the provider's page", () => {
  it("names the short code, and the code opens that page", async () => {
    const artist = await newArtist("Hand Link Artist");
    const phone = uniquePhone();
    await artistEntry(artist, { phone });
    const texts = await smsEventually(phone, "booking_made_link", 1);
    const code = providerLinkCode("artist", artist.user.id);
    expect(texts[0].body).toContain(`frfro.ir/b/${code}`);
    const opened = await fetch(`${TEST_BASE_URL}/b/${code}`, { redirect: "manual" });
    expect(opened.status).toBe(302);
    expect(opened.headers.get("location")).toBe(`/artists/${artist.user.id}`);
  });

  it("a private page gets the text without a link", async () => {
    const salon = await newSalon("Hand Private Salon");
    expect((await salon.api.post("/api/profile/settings", { settings: { publicPortfolio: false } })).ok).toBe(true);
    const phone = uniquePhone();
    await salonEntry(salon, { phone });
    expect(await smsEventually(phone, "booking_made_for_you", 1)).toHaveLength(1);
    expect(await smsSettled(phone, ["booking_made_link"])).toBe(0);
  });

  it("a broken code goes home", async () => {
    const opened = await fetch(`${TEST_BASE_URL}/b/zz!`, { redirect: "manual" });
    expect(opened.status).toBe(302);
    expect(opened.headers.get("location")).toBe("/");
  });
});
