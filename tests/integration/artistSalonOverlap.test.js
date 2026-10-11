import { describe, it, expect } from "vitest";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";

// An artist who works in a salon has one calendar: a salon booking with them and a booking made
// straight with them (their personal page, or one they enter themselves) must never overlap.
async function setup() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Overlap Salon" });
  await salonClient.get("/api/salon-hours");
  const artistClient = createClient();
  const artist = await registerUser(artistClient, { type: "artist", name: "Overlap Artist" });
  expect((await artistClient.post("/api/artist/join-salon", { salonUserId: salon.user.id })).ok).toBe(true);
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff
    .find((person) => Number(person.artist_user_id) === Number(artist.user.id));
  const clientClient = createClient();
  const client = await registerUser(clientClient, { type: "client", name: "Overlap Client" });
  return { salonClient, salon, artistClient, artist, staff, clientClient, client };
}

const bookSalon = (ctx, day, time) => ctx.clientClient.post("/api/salon-bookings", {
  salonUserId: ctx.salon.user.id,
  service: "کوتاهی مو",
  staff: ctx.staff.name,
  bookingDate: day,
  time,
  client: ctx.client.user.name,
  phone: ctx.client.phone
});

const bookArtist = (ctx, day, time, who = ctx.clientClient) => who.post("/api/artist/bookings", {
  artistUserId: ctx.artist.user.id,
  service: "کوتاهی مو",
  bookingDate: day,
  time,
  clientName: "Direct Client",
  clientPhone: "09120000123"
});

describe("an artist's personal bookings and their salon bookings share one calendar", () => {
  it("refuses a personal booking over a salon booking, and the artist's page hides that time", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    expect((await bookSalon(ctx, day, "10:00")).ok).toBe(true);

    const direct = await bookArtist(ctx, day, "10:30");
    expect(direct.status).toBe(409);
    const own = await ctx.artistClient.post("/api/artist/me", {
      kind: "booking", service: "کوتاهی مو", bookingDate: day, time: "10:00", client: "حضوری", phone: "09120000124"
    });
    expect(own.status).toBe(409);

    const page = (await createClient().get(`/api/artists/${ctx.artist.user.id}`)).payload.data;
    const booked = (page.bookedSlots || page.artist?.bookedSlots || []).map((slot) => slot.time);
    expect(booked).toContain("10:00");
  });

  it("refuses a salon booking over the artist's personal booking, and the salon does not offer it", async () => {
    const ctx = await setup();
    const day = futureBookingDay(3);
    expect((await bookArtist(ctx, day, "11:00")).ok).toBe(true);

    const salonSide = await bookSalon(ctx, day, "11:00");
    expect(salonSide.status).toBe(409);

    const times = await ctx.clientClient.get(
      `/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${encodeURIComponent(day)}&service=${encodeURIComponent("کوتاهی مو")}&minutes=60`
    );
    expect(times.ok).toBe(true);
    expect(times.payload.data.times).not.toContain("11:00");
  });

  it("will not move a salon booking onto the artist's personal booking", async () => {
    const ctx = await setup();
    const day = futureBookingDay(4);
    const booking = (await bookSalon(ctx, day, "10:00")).payload.data.booking;
    expect((await bookArtist(ctx, day, "13:00")).ok).toBe(true);

    const moved = await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, time: "13:00" });
    expect(moved.ok).toBe(false);
  });
});
