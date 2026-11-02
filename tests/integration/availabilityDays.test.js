import { describe, it, expect } from "vitest";
import { createClient, registerUser, joinSalonAsArtist, futureBookingDay } from "./helpers.js";

// The client's step form asks the free times of the next two weeks in one go (GET …/availability/days) so every day can
// say «۴ وقت» or «پر». Each day must be exactly what the one-day question answers, or a day would promise times it has not.

const SERVICE = "رنگ چندروزه";

async function setupSalon() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Days Salon" });
  await salonClient.get("/api/salon-hours");
  const artistClient = createClient();
  const artist = await registerUser(artistClient, { type: "artist", name: "Days Artist" });
  expect((await joinSalonAsArtist(artistClient, salonClient, salon.user.id)).ok).toBe(true);
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff.find((p) => Number(p.artist_user_id) === Number(artist.user.id));
  const created = await salonClient.post("/api/salon-services", { name: SERVICE, price: "300", duration: "۴۵ دقیقه" });
  await salonClient.patch("/api/salon-services", { id: created.payload.data.service.id, name: SERVICE, staff_ids: [String(staff.id)] });
  return { salonClient, salon };
}

const oneDay = async (client, salonId, day) => (await client.get(`/api/salon-bookings/availability?salonUserId=${salonId}&day=${encodeURIComponent(day)}&service=${encodeURIComponent(SERVICE)}`)).payload.data.times;
const manyDays = (client, salonId, days, service = SERVICE) => client.get(`/api/salon-bookings/availability/days?salonUserId=${salonId}&${days.map((day) => `day=${encodeURIComponent(day)}`).join("&")}&service=${encodeURIComponent(service)}`);

describe("free times of several days at once", () => {
  it("gives every day exactly the one-day answer, in the order asked, and drops a booked time", async () => {
    const { salon } = await setupSalon();
    const days = [futureBookingDay(2), futureBookingDay(3), futureBookingDay(4)];
    const client = createClient();
    const user = await registerUser(client, { type: "client", name: "Days Client" });
    const answer = await manyDays(client, salon.user.id, days);
    expect(answer.status).toBe(200);
    expect(answer.payload.data.days.map((item) => item.day)).toEqual(days);
    for (const item of answer.payload.data.days) expect(item.times).toEqual(await oneDay(client, salon.user.id, item.day));

    const taken = answer.payload.data.days[1].times[0];
    const booked = await client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: SERVICE, bookingDate: days[1], time: taken, client: user.user.name, phone: user.phone });
    expect(booked.status).toBe(201);
    const after = await manyDays(client, salon.user.id, days);
    expect(after.payload.data.days[1].times).not.toContain(taken);
  });

  it("answers a visitor who is not signed in, like a client", async () => {
    const { salon } = await setupSalon();
    const answer = await manyDays(createClient(), salon.user.id, [futureBookingDay(2)]);
    expect(answer.status).toBe(200);
    expect(answer.payload.data.days[0].times.length).toBeGreaterThan(0);
  });

  it("refuses more than 14 days, a made-up day, and a service the salon does not have", async () => {
    const { salon } = await setupSalon();
    const client = createClient();
    const fifteen = Array.from({ length: 15 }, (_, index) => futureBookingDay(index + 1));
    expect((await manyDays(client, salon.user.id, fifteen)).status).toBe(400);
    expect((await manyDays(client, salon.user.id, ["1404-13-40"])).status).toBe(400);
    expect((await manyDays(client, salon.user.id, [futureBookingDay(2)], "کاری که نیست")).status).toBe(400);
  });
});
