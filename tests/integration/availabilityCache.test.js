import { describe, it, expect } from "vitest";
import { createClient, registerUser, joinSalonAsArtist, futureBookingDay } from "./helpers.js";

// The free-times answer is kept for a few seconds (app/lib/availabilityCache.js). It must never decide a booking:
// a client who was shown a time that has just been taken is refused (409), and no two bookings share the time.

const SERVICE = "کوتاهی کش";

async function setupSalon() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Cache Salon" });
  await salonClient.get("/api/salon-hours");
  const artistClient = createClient();
  const artist = await registerUser(artistClient, { type: "artist", name: "Cache Artist" });
  expect((await joinSalonAsArtist(artistClient, salonClient, salon.user.id)).ok).toBe(true);
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff.find((p) => Number(p.artist_user_id) === Number(artist.user.id));
  const created = await salonClient.post("/api/salon-services", { name: SERVICE, price: "300", duration: "۴۵ دقیقه" });
  await salonClient.patch("/api/salon-services", { id: created.payload.data.service.id, name: SERVICE, staff_ids: [String(staff.id)] });
  return { salonClient, salon };
}

const times = async (client, salonId, day) => (await client.get(`/api/salon-bookings/availability?salonUserId=${salonId}&day=${encodeURIComponent(day)}&service=${encodeURIComponent(SERVICE)}`)).payload.data.times;
const book = (client, user, salonId, day, time) => client.post("/api/salon-bookings", {
  salonUserId: salonId, service: SERVICE, bookingDate: day, time, client: user.user.name, phone: user.phone
});

describe("cached free times", () => {
  it("a booking in this server drops the cached answer at once", async () => {
    const { salon } = await setupSalon();
    const day = futureBookingDay(3);
    const a = createClient(); const ua = await registerUser(a, { type: "client", name: "Cache A" });
    const before = await times(a, salon.user.id, day);
    expect(before.length).toBeGreaterThan(0);
    expect((await times(a, salon.user.id, day)).length).toBe(before.length); // second ask served from memory
    const taken = before[0];
    expect((await book(a, ua, salon.user.id, day, taken)).status).toBe(201);
    expect(await times(a, salon.user.id, day)).not.toContain(taken);
  });

  it("two clients racing for a time the cache still shows: one wins, the other gets 409, nothing is double booked", async () => {
    const { salon, salonClient } = await setupSalon();
    const day = futureBookingDay(3);
    const clients = [];
    for (let i = 0; i < 6; i += 1) { const c = createClient(); clients.push({ c, u: await registerUser(c, { type: "client", name: `Racer ${i}` }) }); }
    const shown = await times(clients[0].c, salon.user.id, day);
    expect(shown[0]).toBe("۱۰:۰۰");
    for (const { c } of clients) expect(await times(c, salon.user.id, day)).toContain(shown[0]); // everyone sees it free (cached)
    const results = await Promise.all(clients.map(({ c, u }) => book(c, u, salon.user.id, day, "10:00")));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(clients.length - 1);
    const rows = (await salonClient.get("/api/salon-bookings")).payload.data.bookings.filter((b) => b.time === "10:00" && b.status !== "لغو");
    expect(rows).toHaveLength(1);
  });
});
