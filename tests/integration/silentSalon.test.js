import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { repeatRequestBody, canRetryExpired } from "../../app/features/client/expiredRequest.js";

const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

async function salonWith(name) {
  const api = createClient();
  const salon = await registerUser(api, { type: "salon", menu: true, name });
  await api.get("/api/salon-hours");
  return { api, salon };
}

/** A client's request that nobody answered in time: its hour ran out and the sweep expired it. */
async function expiredRequest(ctx, client, day, time) {
  const created = await client.api.post("/api/salon-bookings", {
    salonUserId: ctx.salon.user.id, service: "کوتاهی مو", bookingDate: day, time, client: client.user.name, phone: client.phone
  });
  expect(created.status).toBe(201);
  const id = created.payload.data.booking.id;
  await connected;
  await db.query("UPDATE salon_bookings SET created_at = NOW() - INTERVAL '3 hours' WHERE id = $1", [id]);
  const run = await fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
  expect(run.ok).toBe(true);
  const mine = (await client.api.get("/api/client-bookings")).payload.data.salonBookings.find((item) => item.id === id);
  expect(mine.status).toBe("منقضی شده");
  return mine;
}

async function newClient(name) {
  const api = createClient();
  const { user, phone } = await registerUser(api, { type: "client", name });
  return { api, user, phone };
}

describe("silent salon: what the client can do with an expired request", () => {
  it("asks the same salon again for the same time: a fresh request, nothing duplicated while it is open", async () => {
    const ctx = await salonWith("Silent Salon A");
    const client = await newClient("Silent Client A");
    const day = futureBookingDay(3);
    const expired = await expiredRequest(ctx, client, day, "10:00");
    expect(canRetryExpired(expired)).toBe(true);
    const body = repeatRequestBody(expired);
    expect(body).toMatchObject({ salonUserId: ctx.salon.user.id, bookingDate: day, time: "10:00", service: "کوتاهی مو" });
    const again = await client.api.post("/api/salon-bookings", body);
    expect(again.status).toBe(201);
    expect(again.payload.data.booking.status).toBe("درخواست");
    expect(again.payload.data.booking.id).not.toBe(expired.id);
    // A second tap while the fresh one is open gives the same request back.
    const twice = await client.api.post("/api/salon-bookings", body);
    expect(twice.status).toBe(200);
    expect(twice.payload.data.booking.id).toBe(again.payload.data.booking.id);
    // The expired one now shows neither button's work as still needed: the list holds one live request.
    const live = (await client.api.get("/api/client-bookings")).payload.data.salonBookings.filter((item) => item.status === "درخواست");
    expect(live).toHaveLength(1);
  });

  it("is refused with the server's words at the limit of open requests", async () => {
    const ctx = await salonWith("Silent Salon B");
    const client = await newClient("Silent Client B");
    const day = futureBookingDay(3);
    const expired = await expiredRequest(ctx, client, day, "10:00");
    // Fill the client's 3 open requests with this salon at other hours.
    for (const time of ["11:00", "12:00", "13:00"]) {
      expect((await client.api.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: "کوتاهی مو", bookingDate: day, time, client: client.user.name, phone: client.phone })).status).toBe(201);
    }
    const limited = await client.api.post("/api/salon-bookings", repeatRequestBody(expired));
    expect(limited.status).toBe(409);
    expect(limited.payload.code).toBe("TOO_MANY_OPEN_REQUESTS");
    expect(limited.payload.error).toBe("چند تا درخواست منتظر جواب داری. صبر کن جواب یکی بیاد، یا یکی رو لغو کن.");
  });

  it("lists the places the client is connected to that do the same services (the «جای دیگر» list), not the silent salon itself", async () => {
    const first = await salonWith("Silent Salon C1");
    const second = await salonWith("Silent Salon C2");
    const client = await newClient("Silent Client C");
    expect((await client.api.post("/api/connections", { targetUserId: first.salon.user.id })).ok).toBe(true);
    expect((await client.api.post("/api/connections", { targetUserId: second.salon.user.id })).ok).toBe(true);
    const day = futureBookingDay(3);
    const expired = await expiredRequest(first, client, day, "10:00");
    const query = new URLSearchParams({ salonUserId: String(first.salon.user.id), day });
    query.append("service", "کوتاهی مو");
    const listed = (await client.api.get(`/api/salon-bookings/fallbacks?${query}`)).payload.data.salons;
    expect(listed.map((item) => Number(item.id))).toEqual([second.salon.user.id]);
    // Nobody else connected: the list is empty (the card then says «هنوز جای دیگری وصل نکرده‌ای…»).
    const lonely = await newClient("Silent Client D");
    expect((await lonely.api.get(`/api/salon-bookings/fallbacks?${query}`)).payload.data.salons).toEqual([]);
    expect(expired.salon_user_id).toBe(first.salon.user.id);
  });

  it("a request already sent on to a backup salon is not offered a retry", async () => {
    expect(canRetryExpired({ status: "منقضی شده", salon_user_id: 1, booking_date: "فردا", time: "10:00", moved_to_booking_id: 4 })).toBe(false);
  });
});
