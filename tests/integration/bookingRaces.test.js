import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { createClient, registerUser, joinSalonAsArtist, futureBookingDay } from "./helpers.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";

// Two people acting on the same booking at the same moment: the one who loses must be told so, and the
// booking must end in a state that one of the two orders could have produced -- never a cancelled or
// expired request brought back to life, never the salon and the artist's copy disagreeing.

const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

const SERVICE = "مانیکور رقابت"; // 45 min

async function setup() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Race Salon" });
  await salonClient.get("/api/salon-hours");
  const artistClient = createClient();
  const artist = await registerUser(artistClient, { type: "artist", name: "Race Artist" });
  expect((await joinSalonAsArtist(artistClient, salonClient, salon.user.id)).ok).toBe(true);
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff.find((p) => Number(p.artist_user_id) === Number(artist.user.id));
  const created = await salonClient.post("/api/salon-services", { name: SERVICE, price: "300", duration: "۴۵ دقیقه" });
  await salonClient.patch("/api/salon-services", { id: created.payload.data.service.id, name: SERVICE, staff_ids: [String(staff.id)] });
  return { salonClient, salon, artistClient, artist, staff };
}

async function request(ctx, time, dayOffset = 2) {
  const clientClient = createClient();
  const client = await registerUser(clientClient, { type: "client", name: "Race Client" });
  const res = await clientClient.post("/api/salon-bookings", {
    salonUserId: ctx.salon.user.id, service: SERVICE, bookingDate: futureBookingDay(dayOffset), time,
    client: client.user.name, phone: client.phone
  });
  expect(res.status).toBe(201);
  return { id: res.payload.data.booking.id, clientClient };
}

const salonStatus = async (ctx, id) => (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id)?.status;
const mirrorStatuses = async (ctx, id) => (await db.query("SELECT status FROM artist_bookings WHERE source_salon_user_id = $1 AND booking_date = (SELECT booking_date FROM salon_bookings WHERE id = $2) AND time = (SELECT time FROM salon_bookings WHERE id = $2)", [ctx.salon.user.id, id])).rows.map((r) => r.status);
const approve = (ctx, id) => ctx.salonClient.patch("/api/salon-bookings", { id, status: "تایید شده" });
const sweep = () => fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
const makeOverdue = async (id) => { await connected; await db.query("UPDATE salon_bookings SET created_at = NOW() - INTERVAL '3 hours' WHERE id = $1", [id]); };

describe("a request answered twice at once", () => {
  it("the salon approving and the client cancelling: a cancel that went through always wins", async () => {
    const ctx = await setup();
    for (let round = 0; round < 8; round += 1) {
      const { id, clientClient } = await request(ctx, `${10 + (round % 4) * 2}:00`, 2 + Math.floor(round / 4));
      const [a, c] = await Promise.all([approve(ctx, id), clientClient.post(`/api/salon-bookings/${id}/cancel`, {})]);
      const final = await salonStatus(ctx, id);
      expect([200, 409], `round ${round} approve`).toContain(a.status);
      expect([200, 409], `round ${round} cancel`).toContain(c.status);
      if (c.status === 200) expect(final, `round ${round}: cancel succeeded`).toBe("لغو");
      else { expect(a.status, `round ${round}`).toBe(200); expect(final).toBe("تایید شده"); }
      // the artist's calendar copy never disagrees with the salon's booking
      for (const status of await mirrorStatuses(ctx, id)) {
        expect(status === "لغو", `round ${round}: mirror ${status} vs salon ${final}`).toBe(final === "لغو");
      }
    }
  });

  it("the salon approving while the expiry sweep runs: whichever answered first stands", async () => {
    const ctx = await setup();
    for (let round = 0; round < 6; round += 1) {
      const { id } = await request(ctx, `${10 + (round % 4) * 2}:00`, 2 + Math.floor(round / 4));
      await makeOverdue(id);
      const [a] = await Promise.all([approve(ctx, id), sweep()]);
      const final = await salonStatus(ctx, id);
      expect(["تایید شده", "منقضی شده"], `round ${round}`).toContain(final);
      if (a.status === 200) expect(final, `round ${round}: approve succeeded`).toBe("تایید شده");
      else expect(final, `round ${round}: approve refused`).toBe("منقضی شده");
    }
  });

  it("two approvals at once both end well", async () => {
    const ctx = await setup();
    const { id } = await request(ctx, "10:00");
    const results = await Promise.all([approve(ctx, id), approve(ctx, id), approve(ctx, id)]);
    for (const res of results) expect([200, 409]).toContain(res.status);
    expect(results.some((res) => res.status === 200)).toBe(true);
    expect(await salonStatus(ctx, id)).toBe("تایید شده");
  });
});

describe("a dead request stays dead", () => {
  it("an expired request cannot be approved or cancelled back to life", async () => {
    const ctx = await setup();
    const { id, clientClient } = await request(ctx, "10:00");
    await makeOverdue(id);
    expect((await sweep()).status).toBe(200);
    expect(await salonStatus(ctx, id)).toBe("منقضی شده");
    expect((await approve(ctx, id)).status).toBe(409);
    expect((await clientClient.post(`/api/salon-bookings/${id}/cancel`, {})).status).toBe(409);
    expect(await salonStatus(ctx, id)).toBe("منقضی شده");
  });

  it("a cancelled booking cannot be approved, and an approved one never expires", async () => {
    const ctx = await setup();
    const first = await request(ctx, "10:00");
    expect((await first.clientClient.post(`/api/salon-bookings/${first.id}/cancel`, {})).status).toBe(200);
    expect((await approve(ctx, first.id)).status).toBe(409);
    expect(await salonStatus(ctx, first.id)).toBe("لغو");

    const second = await request(ctx, "14:00");
    expect((await approve(ctx, second.id)).status).toBe(200);
    await makeOverdue(second.id);
    await sweep();
    expect(await salonStatus(ctx, second.id)).toBe("تایید شده");
  });

  it("the artist cannot confirm a copy the salon already cancelled", async () => {
    const ctx = await setup();
    const { id } = await request(ctx, "10:00");
    expect((await approve(ctx, id)).status).toBe(200);
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id, status: "لغو", action: "cancel" })).status).toBe(200);
    const mine = (await ctx.artistClient.get("/api/artist/me")).payload.data.bookings.filter((b) => b.booking_date === futureBookingDay(2));
    expect(mine.length).toBeGreaterThan(0);
    for (const row of mine) {
      const res = await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id: row.id, status: "تایید شده" });
      expect(res.status, JSON.stringify(row)).toBe(409);
    }
    expect(await salonStatus(ctx, id)).toBe("لغو");
  });
});
