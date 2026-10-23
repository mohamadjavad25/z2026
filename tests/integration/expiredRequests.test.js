import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";

const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

describe("unanswered booking requests whose day has passed", () => {
  it("are marked expired but stay in the list", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", menu: true, name: "Expiry Salon" });
    await salonClient.get("/api/salon-hours");
    const bookerClient = createClient();
    const booker = await registerUser(bookerClient, { type: "client", name: "Late Booker" });
    const created = await bookerClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "کوتاهی مو",
      bookingDate: futureBookingDay(2),
      time: "۱۰:۰۰",
      client: booker.user.name,
      phone: booker.phone
    });
    expect(created.payload.data.booking.status).toBe("درخواست");
    const id = created.payload.data.booking.id;

    // The day goes by without an answer.
    await connected;
    const threeDaysAgo = formatPersianDateKey(new Date(Date.now() - 3 * 86400000));
    await db.query("UPDATE salon_bookings SET booking_date = $2 WHERE id = $1", [id, threeDaysAgo]);

    const run = await fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
    expect((await run.json()).data.salonExpired).toBeGreaterThanOrEqual(1);

    const list = (await salonClient.get("/api/salon-bookings")).payload.data.bookings;
    expect(list.find((item) => item.id === id)?.status).toBe("منقضی شده");

    // The client has no app and no browser notifications, so the end of the request comes as a text.
    let texts = [];
    for (let i = 0; i < 20 && !texts.some((body) => body.includes("منقضی شد")); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      texts = (await db.query("SELECT body FROM sms_log WHERE phone = $1 AND purpose = 'booking_answer'", [booker.phone])).rows.map((row) => row.body);
    }
    expect(texts.some((body) => body.includes("Expiry Salon") && body.includes("منقضی شد"))).toBe(true);
  });
});
