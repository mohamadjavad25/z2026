import { describe, expect, it } from "vitest";
import { createClient, futureBookingDay, registerUser } from "./helpers.js";

// Found on the live site on 2026-11-06: a service written as «۵ ساعت» held 15 minutes, so the next client could book
// inside it. What the owner saves is what counts, and changing it changes the next booking, never an old one.
describe("a service's length and price come from what its owner saved", () => {
  async function artistWith(duration, price) {
    const client = createClient();
    const account = await registerUser(client, { type: "artist", name: `Length Artist ${Date.now()}` });
    const saved = await client.post("/api/artist/me", { name: "بالیاژ", price, duration });
    expect(saved.ok).toBe(true);
    return { client, id: account.user.id, service: saved.payload.data.service };
  }
  async function booker(name) {
    const client = createClient();
    await registerUser(client, { type: "client", name });
    return client;
  }
  const book = (client, artistUserId, bookingDate, time) => client.post("/api/artist/bookings", { artistUserId, service: "بالیاژ", bookingDate, time });

  it("«۵ ساعت» holds five hours, and the next client cannot book inside them", async () => {
    const artist = await artistWith("۵ ساعت", "از ۲ میلیون");
    const day = futureBookingDay(2);
    const first = await book(await booker("Long First"), artist.id, day, "10:00");
    expect(first.ok).toBe(true);
    expect(Number(first.payload.data.booking.duration_minutes ?? first.payload.data.booking.durationMinutes)).toBe(300);
    expect((await book(await booker("Long Second"), artist.id, day, "12:00")).status).toBe(409);
    expect((await book(await booker("Long Third"), artist.id, day, "15:00")).ok).toBe(true);
  });

  it("a changed length and price reach the page and the next booking; an old booking keeps its own", async () => {
    const artist = await artistWith("۳ ساعت", "از ۵۵۰ هزار");
    const day = futureBookingDay(3);
    expect((await book(await booker("Before Change"), artist.id, day, "10:00")).ok).toBe(true);

    const changed = await artist.client.patch("/api/artist/me", { id: artist.service.id, name: "بالیاژ", price: "۷۰۰ هزار", duration: "۱ ساعت" });
    expect(changed.ok).toBe(true);
    const page = (await createClient().get(`/api/artists/${artist.id}`)).payload.data.artist;
    expect(page.services.find((item) => item.name === "بالیاژ")).toMatchObject({ price: "۷۰۰ هزار", duration: "۱ ساعت" });

    // Still three hours for the first client: 12:00 is inside it.
    expect((await book(await booker("After Inside"), artist.id, day, "12:00")).status).toBe(409);
    const next = await book(await booker("After Free"), artist.id, day, "13:00");
    expect(next.ok).toBe(true);
    expect(Number(next.payload.data.booking.duration_minutes ?? next.payload.data.booking.durationMinutes)).toBe(60);
    // ...and one hour for the new one.
    expect((await book(await booker("After Next"), artist.id, day, "14:00")).ok).toBe(true);
  });

  it("a salon's service written in hours fills its free times by those hours", async () => {
    const salon = createClient();
    const account = await registerUser(salon, { type: "salon", name: `Length Salon ${Date.now()}` });
    expect((await salon.post("/api/salon-services", { name: "کراتین", price: "از ۴ میلیون", duration: "۴ ساعت" })).ok).toBe(true);
    const day = futureBookingDay(2);
    const res = await createClient().get(`/api/salon-bookings/availability?salonUserId=${account.user.id}&service=${encodeURIComponent("کراتین")}&day=${day}&bookingDate=${day}`);
    expect(res.ok).toBe(true);
    expect(res.payload.data.durationMinutes).toBe(240);
  });
});
