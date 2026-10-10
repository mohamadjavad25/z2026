import { describe, it, expect } from "vitest";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";

// A salon with a nail artist and a hair artist, each linked by hand to one service, and a client.
async function setup() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Visit Salon" });
  await salonClient.get("/api/salon-hours");

  const joinAs = async (name) => {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name });
    expect((await client.post("/api/artist/join-salon", { salonUserId: salon.user.id })).ok).toBe(true);
    return { client, user };
  };
  const nail = await joinAs("Visit Nail Artist");
  const hair = await joinAs("Visit Hair Artist");
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
  const staffOf = (artist) => staff.find((person) => Number(person.artist_user_id) === Number(artist.user.id));
  nail.staff = staffOf(nail);
  hair.staff = staffOf(hair);

  const addService = async (name, duration, person) => {
    const created = await salonClient.post("/api/salon-services", { name, price: "300", duration });
    expect(created.ok).toBe(true);
    const service = created.payload.data.service;
    const linked = await salonClient.patch("/api/salon-services", { id: service.id, name, staff_ids: [String(person.id)] });
    expect(linked.ok).toBe(true);
  };
  await addService("مانیکور ویزیت", "۴۵ دقیقه", nail.staff);
  await addService("کوتاهی ویزیت", "۳۰ دقیقه", hair.staff);

  const clientClient = createClient();
  const client = await registerUser(clientClient, { type: "client", name: "Visit Client" });
  return { salonClient, salon, nail, hair, clientClient, client };
}

async function requestVisit(ctx, { bookingDate = futureBookingDay(2), time = "10:00" } = {}) {
  return ctx.clientClient.post("/api/salon-bookings", {
    salonUserId: ctx.salon.user.id,
    service: "مانیکور ویزیت + کوتاهی ویزیت",
    bookingDate,
    time,
    client: ctx.client.user.name,
    phone: ctx.client.phone,
    parts: [
      { service: "مانیکور ویزیت", duration: "۴۵ دقیقه" },
      // A client cannot pick the artist; this is ignored.
      { service: "کوتاهی ویزیت", duration: "۳۰ دقیقه", staff: "someone" }
    ]
  });
}

async function myVisitShare(artist, ctx) {
  const bookings = (await artist.client.get("/api/artist/me")).payload.data.bookings;
  return bookings.filter((b) => b.client_name === ctx.client.user.name && !["لغو", "منقضی شده"].includes(b.status));
}

const partsOf = (booking) => JSON.parse(booking.parts || "[]");

describe("multi-service salon booking", () => {
  it("drafts an artist per service and puts each artist's share in their own calendar", async () => {
    const ctx = await setup();
    const created = await requestVisit(ctx);
    expect(created.status).toBe(201);
    const booking = created.payload.data.booking;
    expect(booking.status).toBe("درخواست");
    expect(booking.service).toBe("مانیکور ویزیت + کوتاهی ویزیت");
    expect(Number(booking.duration_minutes)).toBe(75);
    expect(booking.staff).toBe("");
    expect(partsOf(booking)).toEqual([
      { service: "مانیکور ویزیت", minutes: 45, staff: ctx.nail.staff.name },
      { service: "کوتاهی ویزیت", minutes: 30, staff: ctx.hair.staff.name }
    ]);
    expect(created.payload.data.linkedArtistIds.map(Number).sort()).toEqual([ctx.nail.user.id, ctx.hair.user.id].map(Number).sort());

    const nailShare = await myVisitShare(ctx.nail, ctx);
    expect(nailShare).toHaveLength(1);
    expect(nailShare[0].service).toBe("مانیکور ویزیت");
    expect(nailShare[0].time).toBe("10:00");
    expect(Number(nailShare[0].duration_minutes)).toBe(45);
    const hairShare = await myVisitShare(ctx.hair, ctx);
    expect(hairShare).toHaveLength(1);
    expect(hairShare[0].service).toBe("کوتاهی ویزیت");
    expect(hairShare[0].time).toBe("10:45");
  });

  it("lets the salon reorder the services and moves each artist's share with it", async () => {
    const ctx = await setup();
    const booking = (await requestVisit(ctx)).payload.data.booking;
    const reordered = await ctx.salonClient.patch("/api/salon-bookings", {
      id: booking.id,
      parts: [partsOf(booking)[1], partsOf(booking)[0]]
    });
    expect(reordered.ok).toBe(true);
    expect(reordered.payload.data.booking.service).toBe("کوتاهی ویزیت + مانیکور ویزیت");
    const hairShare = await myVisitShare(ctx.hair, ctx);
    const nailShare = await myVisitShare(ctx.nail, ctx);
    expect(hairShare.map((b) => b.time)).toEqual(["10:00"]);
    expect(nailShare.map((b) => b.time)).toEqual(["10:30"]);
  });

  it("refuses a changed list of services and an artist who is busy", async () => {
    const ctx = await setup();
    const day = futureBookingDay(3);
    const booking = (await requestVisit(ctx, { bookingDate: day })).payload.data.booking;

    const dropped = await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, parts: [partsOf(booking)[0]] });
    expect(dropped.status).toBe(400);

    // The hair artist already has another salon appointment at 10:00.
    const other = await ctx.salonClient.post("/api/salon-bookings", {
      service: "کوتاهی ویزیت", staff: ctx.hair.staff.name, bookingDate: day, time: "12:00", client: "حضوری", phone: "09120000077"
    });
    expect(other.ok).toBe(true);
    const moved = await ctx.salonClient.patch("/api/salon-bookings", {
      id: booking.id,
      parts: [{ ...partsOf(booking)[0], staff: ctx.hair.staff.name }, partsOf(booking)[1]],
      time: "11:30"
    });
    expect(moved.status).toBe(409);
    // Nothing changed.
    const list = (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings;
    expect(partsOf(list.find((b) => b.id === booking.id))).toEqual(partsOf(booking));
  });

  it("approval and cancellation reach every artist; an artist declining only frees their own services", async () => {
    const ctx = await setup();
    const booking = (await requestVisit(ctx, { bookingDate: futureBookingDay(4) })).payload.data.booking;

    const [hairShare] = await myVisitShare(ctx.hair, ctx);
    const declined = await ctx.hair.client.patch("/api/artist/me", { kind: "booking", id: hairShare.id, status: "لغو", action: "cancel" });
    expect(declined.ok).toBe(true);
    let row = (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === booking.id);
    expect(row.status).toBe("درخواست");
    expect(partsOf(row).map((part) => part.staff)).toEqual([ctx.nail.staff.name, ""]);

    const approved = await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, status: "تایید شده" });
    expect(approved.ok).toBe(true);
    expect((await myVisitShare(ctx.nail, ctx)).map((b) => b.status)).toEqual(["تایید شده"]);

    const cancelled = await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, status: "لغو", action: "cancel" });
    expect(cancelled.ok).toBe(true);
    expect(await myVisitShare(ctx.nail, ctx)).toHaveLength(0);
    row = (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === booking.id);
    expect(row.status).toBe("لغو");
  });

  it("does not let another booking take a drafted artist's time", async () => {
    const ctx = await setup();
    const day = futureBookingDay(5);
    expect((await requestVisit(ctx, { bookingDate: day })).status).toBe(201);
    // 10:45–11:15 belongs to the hair artist now.
    const clash = await ctx.salonClient.post("/api/salon-bookings", {
      service: "کوتاهی ویزیت", staff: ctx.hair.staff.name, bookingDate: day, time: "11:00", client: "حضوری", phone: "09120000078"
    });
    expect(clash.status).toBe(409);
    const free = await ctx.salonClient.post("/api/salon-bookings", {
      service: "کوتاهی ویزیت", staff: ctx.hair.staff.name, bookingDate: day, time: "12:00", client: "حضوری", phone: "09120000079"
    });
    expect(free.ok).toBe(true);
  });

  it("holds a staff member's time per service even without an artist account", async () => {
    const ctx = await setup();
    const day = futureBookingDay(6);
    // The manager works too, with no artist account of their own.
    const joined = await ctx.salonClient.post("/api/salon-staff/self", { name: "Visit Manager", role: "ابرو" });
    expect(joined.ok).toBe(true);
    const manager = joined.payload.data.person;
    expect((await ctx.salonClient.post("/api/salon-services", {
      name: "اصلاح ابرو ویزیت", price: "100", duration: "۳۰ دقیقه", staff_ids: [String(manager.id)]
    })).ok).toBe(true);

    const created = await ctx.clientClient.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, service: "x", bookingDate: day, time: "10:00",
      client: ctx.client.user.name, phone: ctx.client.phone,
      parts: [{ service: "مانیکور ویزیت" }, { service: "اصلاح ابرو ویزیت" }]
    });
    expect(created.status).toBe(201);
    expect(partsOf(created.payload.data.booking).map((part) => part.staff)).toEqual([ctx.nail.staff.name, "Visit Manager"]);

    // 10:45–11:15 is the manager's; 11:30 is free.
    const clash = await ctx.salonClient.post("/api/salon-bookings", {
      service: "اصلاح ابرو ویزیت", staff: "Visit Manager", bookingDate: day, time: "11:00", client: "حضوری"
    });
    expect(clash.status).toBe(409);
    const free = await ctx.salonClient.post("/api/salon-bookings", {
      service: "اصلاح ابرو ویزیت", staff: "Visit Manager", bookingDate: day, time: "11:30", client: "حضوری"
    });
    expect(free.ok).toBe(true);
  });
});
