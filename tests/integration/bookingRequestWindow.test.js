import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { getTehranClockMinutes, minutesToPersianTime } from "../../app/shared/lib/time.js";

const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });
const sweep = () => fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });

// A client's request has to be answered by the salon/artist, so it may not start within the next
// 30 minutes (an owner then had 0-10 minutes and found it "expired" before ever seeing it).
const today = () => formatPersianDateKey(new Date());
const inMinutes = (minutes) => minutesToPersianTime(getTehranClockMinutes(new Date()) + minutes);
// Needs the later slot to fall on the same Tehran day.
const nearMidnight = () => getTehranClockMinutes(new Date()) + 110 >= 24 * 60;

describe("a client can't request a time that starts too soon", () => {
  it("salon: refused with TOO_SOON, other reasons stay unchanged", async () => {
    if (nearMidnight()) return;
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", menu: true, name: "Soon Salon" });
    await salonClient.get("/api/salon-hours");
    const clientApi = createClient();
    const client = await registerUser(clientApi, { type: "client", name: "Soon Client" });
    const body = (time) => ({
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: today(), time, client: client.user.name, phone: client.phone
    });
    const soon = await clientApi.post("/api/salon-bookings", body(inMinutes(10)));
    expect(soon.status).toBe(409);
    expect(soon.payload.code).toBe("TOO_SOON");
    const justInside = await clientApi.post("/api/salon-bookings", body(inMinutes(29)));
    expect(justInside.payload.code).toBe("TOO_SOON");
    // Far enough ahead is no longer a TOO_SOON problem (it may still be closed hours at this time of day).
    const later = await clientApi.post("/api/salon-bookings", body(inMinutes(100)));
    expect(later.payload?.code).not.toBe("TOO_SOON");
  });

  it("artist: a client is refused, the artist's own entry is not", async () => {
    if (nearMidnight()) return;
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", menu: true, name: "Soon Artist" });
    const clientApi = createClient();
    await registerUser(clientApi, { type: "client", name: "Soon Booker" });
    const body = (time) => ({ artistUserId: artist.user.id, service: "ناخن", bookingDate: today(), time });
    const soon = await clientApi.post("/api/artist/bookings", body(inMinutes(10)));
    expect(soon.status).toBe(409);
    expect(JSON.stringify(soon.payload)).toContain("حداقل");
    // The artist's own entry (a walk-in, minutes from now) is fine; bookings last an hour, so the
    // client's later request goes well after it.
    const own = await artistClient.post("/api/artist/bookings", { ...body(inMinutes(5)), clientName: "حضوری", clientPhone: "09120000999" });
    expect(own.status).toBe(201);
    const later = await clientApi.post("/api/artist/bookings", body(inMinutes(100)));
    expect(later.status).toBe(201);
  });
});

describe("the sweep closes a request at the earlier of: an hour after sending, or the appointment start", () => {
  async function pending(name) {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", menu: true, name: `${name} Salon` });
    await salonClient.get("/api/salon-hours");
    const clientApi = createClient();
    const client = await registerUser(clientApi, { type: "client", name: `${name} Client` });
    const created = await clientApi.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: futureBookingDay(2), time: "۱۰:۰۰", client: client.user.name, phone: client.phone
    });
    expect(created.payload.data.booking.status).toBe("درخواست");
    return { salonClient, id: created.payload.data.booking.id };
  }
  const statusOf = async ({ salonClient, id }) => (await salonClient.get("/api/salon-bookings")).payload.data.bookings.find((item) => item.id === id)?.status;

  it("keeps a fresh request for a later day, expires it after the hour", async () => {
    const req = await pending("Window");
    await connected;
    await db.query("UPDATE salon_bookings SET created_at = NOW() - INTERVAL '5 minutes' WHERE id = $1", [req.id]);
    await sweep();
    expect(await statusOf(req)).toBe("درخواست");
    await db.query("UPDATE salon_bookings SET created_at = NOW() - INTERVAL '61 minutes' WHERE id = $1", [req.id]);
    await sweep();
    expect(await statusOf(req)).toBe("منقضی شده");
  });

  it("expires a just-sent request whose appointment time has started, and the owner can't confirm it", async () => {
    if (getTehranClockMinutes(new Date()) < 10) return;
    const req = await pending("Started");
    await connected;
    await db.query("UPDATE salon_bookings SET booking_date = $2, time = $3 WHERE id = $1", [req.id, today(), minutesToPersianTime(getTehranClockMinutes(new Date()) - 5)]);
    await sweep();
    expect(await statusOf(req)).toBe("منقضی شده");
    const confirm = await req.salonClient.patch("/api/salon-bookings", { id: req.id, status: "تایید شده" });
    expect(confirm.status).toBe(409);
    expect(confirm.payload.code).toBe("BOOKING_EXPIRED");
  });
});
