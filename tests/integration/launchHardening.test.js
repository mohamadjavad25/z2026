import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { createClient, registerUser, uniquePhone, futureBookingDay } from "./helpers.js";

/**
 * The pre-launch fixes: a password the form would refuse is refused by the server too, public auth routes are
 * throttled per address (not only per phone), the booking request and its answer leave an SMS when the pattern is
 * set, and a booking can't be given a status no screen knows.
 */
const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

const fromIp = (ip) => ({ headers: { "x-real-ip": ip } });
let ipCounter = 0;
const freshIp = () => `10.77.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

async function smsTo(phone, purpose) {
  await connected;
  const { rows } = await db.query("SELECT body FROM sms_log WHERE phone = $1 AND purpose = $2 ORDER BY id DESC", [phone, purpose]);
  return rows.map((row) => row.body);
}

async function eventually(read, check, tries = 20) {
  for (let i = 0; i < tries; i += 1) {
    const value = await read();
    if (check(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return read();
}

describe("sign-up password", () => {
  it("refuses a password shorter than 8 characters even from a direct API call", async () => {
    const res = await createClient().post("/api/auth/register", { phone: uniquePhone(), password: "123", type: "client", name: "کوتاه" });
    expect(res.status).toBe(400);
    expect(res.payload.error).toMatch(/۸/);
  });
});

describe("per-address throttles", () => {
  it("stops one address walking wrong passwords across many phones", async () => {
    const ip = freshIp();
    const statuses = [];
    for (let i = 0; i < 31; i += 1) {
      statuses.push((await createClient().post("/api/auth/login", { phone: uniquePhone(), password: "wrongpass1" }, fromIp(ip))).status);
    }
    expect(statuses.slice(0, 30).every((status) => status === 401)).toBe(true);
    expect(statuses[30]).toBe(429);
    // Another address is not affected.
    expect((await createClient().post("/api/auth/login", { phone: uniquePhone(), password: "wrongpass1" }, fromIp(freshIp()))).status).toBe(401);
  });

  it("ignores an address the caller typed in front of the proxy's own", async () => {
    const ip = freshIp();
    for (let i = 0; i < 30; i += 1) {
      await createClient().post("/api/auth/login", { phone: uniquePhone(), password: "wrongpass1" }, fromIp(ip));
    }
    // A forged first X-Forwarded-For entry changes nothing: the proxy's X-Real-IP decides.
    const forged = await createClient().post("/api/auth/login", { phone: uniquePhone(), password: "wrongpass1" }, {
      headers: { "x-real-ip": ip, "x-forwarded-for": `1.2.3.4, ${ip}` }
    });
    expect(forged.status).toBe(429);
  });

  it("limits SMS codes per address so nobody can use up everyone's hourly budget", async () => {
    const ip = freshIp();
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await createClient().post("/api/auth/otp/send", { phone: uniquePhone(), purpose: "register" }, fromIp(ip))).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("booking SMS", () => {
  it("texts the salon about a new request and the client about the answer", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "سالن پیامک" });
    await salonClient.get("/api/salon-hours");
    const clientClient = createClient();
    const client = await registerUser(clientClient, { type: "client", name: "مشتری پیامک" });

    const created = await clientClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: futureBookingDay(2), time: "10:00", client: client.user.name, phone: client.phone
    });
    expect(created.status).toBe(201);
    const toSalon = await eventually(() => smsTo(salon.phone, "booking_request"), (list) => list.length > 0);
    expect(toSalon[0]).toContain("درخواست نوبت تازه");
    expect(toSalon[0]).toContain("مشتری پیامک");

    const approved = await salonClient.patch("/api/salon-bookings", { id: created.payload.data.booking.id, status: "تایید شده" });
    expect(approved.ok).toBe(true);
    const toClient = await eventually(() => smsTo(client.phone, "booking_answer"), (list) => list.length > 0);
    expect(toClient[0]).toContain("تأیید شد");
    expect(toClient[0]).toContain("سالن پیامک");
  });
});

describe("booking status", () => {
  it("refuses a status no screen knows, at the database", async () => {
    await connected;
    const { rows } = await db.query("SELECT id FROM salon_bookings ORDER BY id DESC LIMIT 1");
    expect(rows.length).toBe(1);
    await expect(db.query("UPDATE salon_bookings SET status = 'تاییدشده' WHERE id = $1", [rows[0].id])).rejects.toThrow(/salon_bookings_status_known/);
  });
});
