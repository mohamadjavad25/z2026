import { describe, it, expect } from "vitest";
import { createClient, joinSalonAsArtist, registerUser, futureBookingDay } from "./helpers.js";

const M = "مانیکور اعتماد"; // 45 min, nail artist
const H = "کوتاهی اعتماد"; // 30 min, hair artist

async function setup() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Trust Salon" });
  await salonClient.get("/api/salon-hours");
  const joinAs = async (name) => {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name });
    expect((await joinSalonAsArtist(client, salonClient, salon.user.id)).ok).toBe(true);
    return { client, user };
  };
  const nail = await joinAs("Trust Nail");
  const hair = await joinAs("Trust Hair");
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
  const staffOf = (a) => staff.find((p) => Number(p.artist_user_id) === Number(a.user.id));
  nail.staff = staffOf(nail);
  hair.staff = staffOf(hair);
  for (const [name, duration, person] of [[M, "۴۵ دقیقه", nail.staff], [H, "۳۰ دقیقه", hair.staff]]) {
    const created = await salonClient.post("/api/salon-services", { name, price: "300", duration });
    await salonClient.patch("/api/salon-services", { id: created.payload.data.service.id, name, staff_ids: [String(person.id)] });
  }
  const clientClient = createClient();
  const client = await registerUser(clientClient, { type: "client", name: "Trust Client" });
  return { salonClient, salon, nail, hair, clientClient, client };
}

describe("a client cannot decide how a booking is laid out", () => {
  it("the length of a listed service is the salon's, whatever the request says", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const tries = [
      { time: "10:00", durationMinutes: 15 },
      { time: "11:00", duration: "15 دقیقه" },
      { time: "12:00", durationMinutes: 100000 },
      { time: "13:00", duration_minutes: 1 }
    ];
    for (const extra of tries) {
      const res = await ctx.clientClient.post("/api/salon-bookings", {
        salonUserId: ctx.salon.user.id, service: M, bookingDate: day, client: ctx.client.user.name, phone: ctx.client.phone, ...extra
      });
      expect(res.status, JSON.stringify(extra)).toBe(201);
      expect(Number(res.payload.data.booking.duration_minutes), JSON.stringify(extra)).toBe(45);
    }
  });

  it("the artist for a single service is the draft's, not one the client names", async () => {
    const ctx = await setup();
    const res = await ctx.clientClient.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, service: M, bookingDate: futureBookingDay(2), time: "10:00",
      client: ctx.client.user.name, phone: ctx.client.phone, staff: ctx.hair.staff.name
    });
    expect(res.status).toBe(201);
    expect(res.payload.data.booking.staff).toBe(ctx.nail.staff.name);
    expect((await ctx.hair.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === ctx.client.user.name)).toHaveLength(0);
    // and a name that is nobody's at all changes nothing
    const odd = await ctx.clientClient.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, service: M, bookingDate: futureBookingDay(2), time: "12:00",
      client: ctx.client.user.name, phone: ctx.client.phone, staff: "x".repeat(5000)
    });
    expect([201, 400]).toContain(odd.status);
    if (odd.status === 201) expect(odd.payload.data.booking.staff).toBe(ctx.nail.staff.name);
  });

  it("an unlisted service cannot be made longer than half a day", async () => {
    const ctx = await setup();
    const res = await ctx.clientClient.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, bookingDate: futureBookingDay(2), time: "10:00", client: ctx.client.user.name, phone: ctx.client.phone,
      service: "x", parts: [{ service: "ناشناس یک", durationMinutes: 99999 }, { service: "ناشناس دو", durationMinutes: 99999 }]
    });
    expect(res.status).toBeLessThan(500);
    if (res.status === 201) expect(Number(res.payload.data.booking.duration_minutes)).toBeLessThanOrEqual(1440);
    const single = await ctx.salonClient.post("/api/salon-bookings", { service: M, staff: ctx.nail.staff.name, bookingDate: futureBookingDay(3), time: "10:00", client: "حضوری", durationMinutes: 100000 });
    expect(single.status).toBeLessThan(500);
    if (single.status === 201) expect(Number(single.payload.data.booking.duration_minutes)).toBeLessThanOrEqual(720);
  });
});

describe("nobody can put a booking into another person's account", () => {
  it("the salon's clientUserId is ignored: the booking stays with the typed name and number", async () => {
    const ctx = await setup();
    const victim = createClient();
    const v = await registerUser(victim, { type: "client", name: "Victim" });
    const res = await ctx.salonClient.post("/api/salon-bookings", {
      service: H, staff: ctx.hair.staff.name, bookingDate: futureBookingDay(2), time: "10:00", client: "حضوری", phone: "09120009911",
      clientUserId: v.user.id, client_user_id: v.user.id
    });
    expect(res.status).toBe(201);
    expect(res.payload.data.booking.client_user_id).toBeNull();
    const theirs = (await victim.get("/api/client-bookings")).payload.data?.bookings ?? [];
    const salonSide = (await victim.get("/api/salon-bookings")).payload.data.bookings;
    expect(theirs).toHaveLength(0);
    expect(salonSide.filter((b) => b.client === "حضوری")).toHaveLength(0);
  });

  it("a client's request is always theirs, whatever id the body claims", async () => {
    const ctx = await setup();
    const other = createClient();
    const o = await registerUser(other, { type: "client", name: "Other" });
    const res = await ctx.clientClient.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, service: H, bookingDate: futureBookingDay(2), time: "10:00",
      client: "Other", phone: o.phone, clientUserId: o.user.id
    });
    expect(res.status).toBe(201);
    expect(Number(res.payload.data.booking.client_user_id)).toBe(Number(ctx.client.user.id));
  });
});

describe("a booking at an independent artist is as long as the artist says", () => {
  it("whoever books a listed service gets its length; the artist's own entry may choose but stays under half a day", async () => {
    const artistApi = createClient();
    const artist = await registerUser(artistApi, { type: "artist", name: "Trust Solo" });
    expect((await artistApi.post("/api/artist/me", { name: "خدمت نود دقیقه", price: "100", duration: "۹۰ دقیقه" })).ok).toBe(true);
    const day = futureBookingDay(2);
    const client = createClient();
    const c = await registerUser(client, { type: "client", name: "Trust Solo Client" });
    const anonymous = createClient();
    const cases = [
      [client, { time: "10:00", durationMinutes: 15 }],
      [client, { time: "12:00", duration: "15 دقیقه" }],
      [anonymous, { time: "14:00", durationMinutes: 1, clientName: "ناشناس", clientPhone: "09120000000" }],
      [client, { time: "16:00", duration_minutes: 100000 }]
    ];
    for (const [who, extra] of cases) {
      const res = await who.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "خدمت نود دقیقه", bookingDate: day, clientName: c.user.name, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(201);
      expect(Number(res.payload.data.booking.duration_minutes), JSON.stringify(extra)).toBe(90);
    }
    const own = await artistApi.post("/api/artist/me", { kind: "booking", client: "خودم", service: "هر چیزی", time: "09:00", date: futureBookingDay(3), durationMinutes: 100000 });
    expect(own.status).toBe(201);
    expect(Number(own.payload.data.booking.duration_minutes)).toBe(720);
    const short = await artistApi.post("/api/artist/me", { kind: "booking", client: "کوتاه", service: "هر چیزی", time: "22:00", date: futureBookingDay(3), durationMinutes: 1 });
    expect(Number(short.payload.data.booking.duration_minutes)).toBe(15);
  });
});

describe("odd requests are refused, never a crash", () => {
  it("the booking, availability and preview routes answer every malformed input below 500", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const base = { salonUserId: ctx.salon.user.id, service: M, bookingDate: day, time: "10:00", client: "x", phone: "0912" };
    const bodies = [
      {}, { ...base, service: ["a"] }, { ...base, service: 5 }, { ...base, time: ["10:00"] }, { ...base, time: 1000 }, { ...base, time: "zz" },
      { ...base, bookingDate: {} }, { ...base, bookingDate: "9999-99-99" }, { ...base, bookingDate: "امروز".repeat(500) }, { ...base, client: null }, { ...base, client: "y".repeat(10000) },
      { ...base, phone: "z".repeat(10000) }, { ...base, parts: "x" }, { ...base, parts: [null] }, { ...base, parts: [{}] }, { ...base, parts: [{ service: 5 }] },
      { ...base, parts: Array.from({ length: 9 }, () => ({ service: M })) }, { ...base, parts: [{ service: M, duration: "abc", durationMinutes: "x", staff: 7 }] },
      { ...base, parts: [{ service: M }, { service: M }] }, { ...base, salonUserId: "abc" }, { ...base, salonUserId: -1 }, { ...base, salonUserId: 99999999 },
      { ...base, durationMinutes: "abc" }, { ...base, durationMinutes: -5 }, { ...base, staff: { a: 1 } }, { ...base, status: "تایید شده" }, { ...base, clientUserId: "x" },
      { ...base, __proto__: { admin: true } }
    ];
    for (const [i, body] of bodies.entries()) {
      for (const who of [ctx.clientClient, ctx.salonClient]) {
        const res = await who.post("/api/salon-bookings", body);
        expect(res.status, `#${i} ${JSON.stringify(body).slice(0, 90)} -> ${res.status}`).toBeLessThan(500);
      }
    }
    const urls = [
      "/api/salon-bookings/availability", "/api/salon-bookings/availability?salonUserId=abc", `/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${day}`,
      `/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${day}&service=${encodeURIComponent(M)}&minutes=abc`,
      `/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${day}&service=${encodeURIComponent(M)}&minutes=-5`,
      `/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${day}&service=${encodeURIComponent(M)}&minutes=99999999`,
      `/api/salon-bookings/availability?salonUserId=${ctx.salon.user.id}&day=${encodeURIComponent("😀")}&service=${encodeURIComponent(M)}`,
      `/api/salon-bookings/preview?salonUserId=${ctx.salon.user.id}&day=${day}&time=10:00&service=${encodeURIComponent(M)}&staff=${"a".repeat(5000)}`,
      `/api/salon-bookings/preview?salonUserId=${ctx.salon.user.id}&day=${day}&time=10:00&service=${encodeURIComponent(M)}&minutes=abc&staff=`,
      `/api/salon-bookings/preview?salonUserId=${ctx.salon.user.id}&day=${day}&time=10:00&service=${encodeURIComponent(M)}&service=${encodeURIComponent(M)}&staff=a`
    ];
    for (const url of urls) {
      for (const who of [ctx.clientClient, ctx.salonClient]) {
        const res = await who.get(url);
        expect(res.status, `${url.slice(0, 120)} -> ${res.status}`).toBeLessThan(500);
      }
    }
    const artistBodies = [{}, { artistUserId: "x" }, { artistUserId: ctx.nail.user.id }, { artistUserId: ctx.nail.user.id, service: ["a"], time: "10:00" }, { artistUserId: ctx.nail.user.id, service: "a", time: "zz", bookingDate: day }, { artistUserId: ctx.nail.user.id, service: "a", time: "10:00", bookingDate: day, durationMinutes: "abc" }];
    for (const body of artistBodies) {
      const res = await ctx.clientClient.post("/api/artist/bookings", body);
      expect(res.status, JSON.stringify(body)).toBeLessThan(500);
    }
  });
});
