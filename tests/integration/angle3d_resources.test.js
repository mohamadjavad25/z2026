import { describe, it, expect, afterAll } from "vitest";
import { newSalon, newClient, db, connected, futureBookingDay, createClient, ipHeaders, TEST_BASE_URL } from "./angle3Helpers.js";

afterAll(async () => { await connected; await db.end(); });

describe("angle3d: resource abuse", () => {
  it("a service name / price / duration of 100k characters is refused", async () => {
    const salon = await newSalon("Big Name Salon", []);
    const res = await salon.client.post("/api/salon-services", { name: "ا".repeat(100_000), price: "1", duration: "60 دقیقه" });
    console.log("[big-service] status", res.status);
    expect(res.ok).toBe(false);
  });

  it("a salon cannot create unlimited services (they ride on every public directory response)", async () => {
    const salon = await newSalon("Many Services", []);
    let created = 0;
    for (let i = 0; i < 250; i += 1) {
      const r = await salon.client.post("/api/salon-services", { name: `خدمت ${i}`, price: "1", duration: "30 دقیقه" });
      if (r.status === 201) created += 1; else break;
    }
    const list = await createClient().get("/api/salons?limit=50");
    const mine = list.payload.data.salons.find((s) => s.id === salon.user.id);
    console.log("[many-services] created", created, "services listed in public directory entry:", mine?.services?.length);
    expect(created).toBeLessThanOrEqual(100);
  });

  it("portfolio writes are throttled", async () => {
    const salon = await newSalon("Portfolio Spam", []);
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const statuses = [];
    for (let i = 0; i < 70; i += 1) statuses.push((await salon.client.post("/api/salon-portfolio", { title: `p${i}`, image: png })).status);
    const ok = statuses.filter((s) => s === 201).length;
    console.log("[portfolio] created", ok, "of 70, 429s:", statuses.filter((s) => s === 429).length);
    expect(statuses).toContain(429);
    const list = await salon.client.get("/api/salon-portfolio");
    console.log("[portfolio] items stored:", list.payload.data.portfolio.length, "(no per-account cap besides the 60/10min throttle)");
  });

  it("a huge JSON body to a booking route is refused cleanly (not a 500)", async () => {
    const salon = await newSalon("Body Salon");
    const c = await newClient("Body Client");
    const res = await fetch(`${TEST_BASE_URL}/api/salon-bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: c.client.cookie() },
      body: JSON.stringify({ salonUserId: salon.user.id, service: "x", bookingDate: futureBookingDay(2), time: "10:00", junk: "A".repeat(12 * 1024 * 1024) })
    });
    console.log("[big-body] status", res.status);
    expect([200, 201, 400, 413]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it("support: attachments are capped per message and per hour (and the abuse ceiling per account is recorded)", async () => {
    const c = await newClient("Support Spammer");
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(900_000, 1)]).toString("base64");
    const attachments = Array.from({ length: 3 }, () => ({ kind: "image", data: `data:image/png;base64,${png}` }));
    const statuses = [];
    for (let i = 0; i < 7; i += 1) statuses.push((await c.client.post("/api/support", { category: "other", subject: "s", message: "x".repeat(20), attachments })).status);
    console.log("[support] statuses", statuses.join(","), "-> ~", statuses.filter((s) => s === 201).length * 2.7, "MB stored for one account in an hour");
    expect(statuses).toContain(429);
  });

  it("listing a salon's availability stays fast when the salon has 1500 bookings (every client can call it)", async () => {
    const salon = await newSalon("Busy Salon");
    await db.query(`
      INSERT INTO salon_bookings (salon_user_id, client, phone, service, booking_date, time, duration_minutes, status)
      SELECT $1, 'Cust ' || g, '0913' || lpad(g::text, 7, '0'), 'کراتین مو', '1404-01-01', '10:00', 60, 'لغو' FROM generate_series(1, 1500) g
    `, [salon.user.id]);
    const c = await newClient("Availability Poller");
    const t0 = Date.now();
    const rs = await Promise.all(Array.from({ length: 10 }, () => c.client.get(`/api/salon-bookings?salonUserId=${salon.user.id}`)));
    const ms = Date.now() - t0;
    console.log("[busy-salon] 10 parallel availability reads:", ms, "ms, statuses", rs.map((r) => r.status).join(","));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(ms).toBeLessThan(3000);
  });
});
