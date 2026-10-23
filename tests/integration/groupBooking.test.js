import { describe, it, expect } from "vitest";
import { createClient, joinSalonAsArtist, registerUser, futureBookingDay } from "./helpers.js";

// A salon with `count` hair artists who all do one 30-minute service, and a few clients.
async function setup(count = 2) {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Group Salon" });
  await salonClient.get("/api/salon-hours");
  const artists = [];
  for (let index = 0; index < count; index += 1) {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name: `Group Artist ${index}` });
    expect((await joinSalonAsArtist(client, salonClient, salon.user.id)).ok).toBe(true);
    artists.push({ client, user });
  }
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
  const created = await salonClient.post("/api/salon-services", { name: "کوتاهی گروهی", price: "300", duration: "۳۰ دقیقه" });
  expect(created.ok).toBe(true);
  const service = created.payload.data.service;
  const linked = await salonClient.patch("/api/salon-services", { id: service.id, name: "کوتاهی گروهی", staff_ids: staff.map((person) => String(person.id)) });
  expect(linked.ok).toBe(true);
  return { salonClient, salon, artists };
}

async function newClient(name) {
  const api = createClient();
  const { user, phone } = await registerUser(api, { type: "client", name });
  return { api, user, phone };
}

const timesFor = async (ctx, who, day, people) => {
  const query = new URLSearchParams({ salonUserId: String(ctx.salon.user.id), day });
  query.append("service", "کوتاهی گروهی");
  if (people > 1) query.set("people", String(people));
  return (await who.api.get(`/api/salon-bookings/availability?${query}`)).payload.data.times;
};

const request = (ctx, who, day, time, extra = {}) => who.api.post("/api/salon-bookings", {
  salonUserId: ctx.salon.user.id,
  service: "کوتاهی گروهی",
  bookingDate: day,
  time,
  client: who.user.name,
  phone: who.phone,
  ...extra
});

describe("group booking (برای چند نفر؟)", () => {
  it("offers only times where enough artists are free at once, and books the group as one request", async () => {
    const ctx = await setup(2);
    const day = futureBookingDay(2);
    const a = await newClient("Group A");
    const b = await newClient("Group B");
    const alone = await timesFor(ctx, a, day, 1);
    expect(alone.length).toBeGreaterThan(2);
    const pair = await timesFor(ctx, a, day, 2);
    expect(pair).toEqual(alone); // an empty salon: two artists are free whenever one is

    // A lone client takes one artist at the first time: that time can no longer seat two.
    expect((await request(ctx, b, day, alone[0])).status).toBe(201);
    const pairAfter = await timesFor(ctx, a, day, 2);
    expect(pairAfter).not.toContain(alone[0]);
    expect(await timesFor(ctx, a, day, 1)).toContain(alone[0]);

    // 3 people cannot be seated by 2 artists anywhere.
    expect(await timesFor(ctx, a, day, 3)).toEqual([]);

    const sent = await request(ctx, a, day, pairAfter[0], { people: 2 });
    expect(sent.status).toBe(201);
    const booking = sent.payload.data.booking;
    expect(booking.service).toContain("۲ نفر");
    expect(Number(booking.duration_minutes)).toBe(30);
    const parts = JSON.parse(booking.parts);
    expect(parts).toHaveLength(2);
    expect(parts[0].staff).not.toBe(parts[1].staff);
    expect(parts[1].person).toBe(1);
    expect(sent.payload.data.linkedArtistIds).toHaveLength(2);

    // The salon sees ONE request for 2 people.
    const list = (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings.filter((item) => item.client === a.user.name);
    expect(list).toHaveLength(1);
    // It counts as one open request for the client.
    const mine = (await a.api.get("/api/salon-bookings")).payload.data.bookings.filter((item) => item.status === "درخواست");
    expect(mine).toHaveLength(1);

    // Each artist has their own share in the calendar.
    for (const artist of ctx.artists) {
      const shares = (await artist.client.get("/api/artist/me")).payload.data.bookings.filter((item) => item.client_name === a.user.name || item.client === a.user.name);
      expect(shares.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("refuses a group the team can no longer seat, books nothing, and says so in the owner's words", async () => {
    const ctx = await setup(2);
    const day = futureBookingDay(2);
    const a = await newClient("Group Full A");
    const b = await newClient("Group Full B");
    const times = await timesFor(ctx, a, day, 2);
    const slot = times[0];
    expect((await request(ctx, b, day, slot)).status).toBe(201); // one artist gone
    const refused = await request(ctx, a, day, slot, { people: 2 });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("GROUP_FULL");
    expect(refused.payload.error).toBe("این ساعت دیگه برای ۲ نفر جا نداره؛ ساعت‌ها رو تازه کردیم.");
    const salonList = (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings;
    expect(salonList.filter((item) => item.client === a.user.name)).toHaveLength(0);
    // Not even an artist calendar copy was left behind.
    for (const artist of ctx.artists) {
      const shares = (await artist.client.get("/api/artist/me")).payload.data.bookings.filter((item) => (item.client_name || item.client) === a.user.name);
      expect(shares).toHaveLength(0);
    }
  });

  it("when two groups race for the last two seats exactly one wins", async () => {
    const ctx = await setup(2);
    const day = futureBookingDay(2);
    const a = await newClient("Race A");
    const b = await newClient("Race B");
    const slot = (await timesFor(ctx, a, day, 2))[0];
    const [one, two] = await Promise.all([request(ctx, a, day, slot, { people: 2 }), request(ctx, b, day, slot, { people: 2 })]);
    expect([one.status, two.status].sort()).toEqual([201, 409]);
  });

  it("a salon with no team on frfro has one seat: no common hour for 2, but one after another works", async () => {
    const ctx = await setup(0);
    const day = futureBookingDay(2);
    const a = await newClient("Seat A");
    expect((await timesFor(ctx, a, day, 1)).length).toBeGreaterThan(2);
    expect(await timesFor(ctx, a, day, 2)).toEqual([]);
    const refused = await request(ctx, a, day, "10:00", { people: 2 });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("GROUP_FULL");
  });

  it("limits a request to 3 people and keeps the services per person within the parts cap", async () => {
    const ctx = await setup(3);
    const day = futureBookingDay(2);
    const a = await newClient("Cap A");
    const slot = (await timesFor(ctx, a, day, 3))[0];
    expect((await request(ctx, a, day, slot, { people: 4 })).status).toBe(400);
    const three = await request(ctx, a, day, slot, { people: 3 });
    expect(three.status).toBe(201);
    expect(three.payload.data.booking.service).toContain("۳ نفر");
  });

  it("the consecutive fallback is just the same service twice back to back (existing multi-service request)", async () => {
    const ctx = await setup(1);
    const day = futureBookingDay(2);
    const a = await newClient("Chain A");
    const query = new URLSearchParams({ salonUserId: String(ctx.salon.user.id), day });
    query.append("service", "کوتاهی گروهی");
    query.append("service", "کوتاهی گروهی");
    const times = (await a.api.get(`/api/salon-bookings/availability?${query}`)).payload.data.times;
    expect(times.length).toBeGreaterThan(0);
    const sent = await request(ctx, a, day, times[0], {
      service: "کوتاهی گروهی + کوتاهی گروهی",
      parts: [{ service: "کوتاهی گروهی", duration: "۳۰ دقیقه" }, { service: "کوتاهی گروهی", duration: "۳۰ دقیقه" }]
    });
    expect(sent.status).toBe(201);
    expect(Number(sent.payload.data.booking.duration_minutes)).toBe(60);
  });
});
