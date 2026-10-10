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

  it("offers the client only start times at which every service has a free artist", async () => {
    const ctx = await setup();
    const day = futureBookingDay(7);
    const latin = (times) => times.map((time) => time.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    const visitTimes = async (services, onDay = day) => {
      const query = new URLSearchParams({ salonUserId: String(ctx.salon.user.id), day: onDay });
      services.forEach((service) => query.append("service", service));
      return ctx.clientClient.get(`/api/salon-bookings/availability?${query}`);
    };

    const before = await visitTimes(["مانیکور ویزیت", "کوتاهی ویزیت"]);
    expect(before.ok).toBe(true);
    expect(before.payload.data.durationMinutes).toBe(75);
    expect(latin(before.payload.data.times)).toContain("10:00");

    // The only hair artist is busy 11:00–11:30, so a visit whose haircut would overlap it is not offered.
    expect((await ctx.salonClient.post("/api/salon-bookings", {
      service: "کوتاهی ویزیت", staff: ctx.hair.staff.name, bookingDate: day, time: "11:00", client: "حضوری", phone: "09120000081"
    })).ok).toBe(true);
    const after = latin((await visitTimes(["مانیکور ویزیت", "کوتاهی ویزیت"])).payload.data.times);
    expect(after).not.toContain("10:00");
    expect(after).not.toContain("10:30");
    expect(after).toContain("11:30");
    // In the other order the haircut comes first and 10:00 works again.
    expect(latin((await visitTimes(["کوتاهی ویزیت", "مانیکور ویزیت"])).payload.data.times)).toContain("10:00");

    // The server holds the same line: a request at a time that was not offered is refused.
    const refused = await requestVisit(ctx, { bookingDate: day, time: "10:00" });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("NO_FREE_ARTIST");
    expect((await requestVisit(ctx, { bookingDate: day, time: "11:30" })).status).toBe(201);
    expect(latin((await visitTimes(["مانیکور ویزیت", "کوتاهی ویزیت"])).payload.data.times)).not.toContain("11:30");

    // A service nobody at the salon is linked to does not need an artist (it only needs the
    // salon to be free, so it is checked on an empty day).
    expect((await ctx.salonClient.post("/api/salon-services", { name: "ماساژ ویزیت", price: "200", duration: "۳۰ دقیقه" })).ok).toBe(true);
    expect(latin((await visitTimes(["مانیکور ویزیت", "ماساژ ویزیت"], futureBookingDay(8))).payload.data.times)).toContain("10:00");

    expect((await visitTimes(["مانیکور ویزیت", "خدمت ناشناس"])).status).toBe(400);
  });

  it("offers a single service only the times a request would get, around a visit already booked", async () => {
    const ctx = await setup();
    const day = futureBookingDay(13);
    const latin = (times) => times.map((time) => time.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    const singleTimes = async (service) => {
      const query = new URLSearchParams({ salonUserId: String(ctx.salon.user.id), day, service });
      const response = await ctx.clientClient.get(`/api/salon-bookings/availability?${query}`);
      expect(response.ok).toBe(true);
      return latin(response.payload.data.times);
    };
    // A visit 10:00–11:15 (manicure, then haircut).
    expect((await requestVisit(ctx, { bookingDate: day, time: "10:00" })).status).toBe(201);
    const times = await singleTimes("مانیکور ویزیت");
    for (const taken of ["09:30", "10:00", "10:30", "11:00"]) expect(times).not.toContain(taken);
    expect(times).toContain("11:30");

    // Every time not offered is refused, every offered one goes through.
    const book = (time, phone) => ctx.clientClient.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, service: "مانیکور ویزیت", bookingDate: day, time,
      client: ctx.client.user.name, phone
    });
    expect((await book("11:00", ctx.client.phone)).status).toBe(409);
    expect((await book("11:30", ctx.client.phone)).status).toBe(201);
    expect(await singleTimes("مانیکور ویزیت")).not.toContain("11:30");

    // A service the salon does not list needs its length from the client.
    const query = new URLSearchParams({ salonUserId: String(ctx.salon.user.id), day, service: "خدمت ناشناس" });
    expect((await ctx.clientClient.get(`/api/salon-bookings/availability?${query}`)).status).toBe(400);
    query.append("minutes", "30");
    expect((await ctx.clientClient.get(`/api/salon-bookings/availability?${query}`)).ok).toBe(true);
  });
});

describe("salon offers a client a new time", () => {
  const AWAITING = "در انتظار مشتری";
  const clientRow = async (ctx, id) => (await ctx.clientClient.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id);
  const answer = (client, id, accept) => client.post(`/api/salon-bookings/${id}/answer`, { accept });

  it("moving a client's visit waits for the client; accepting confirms it for every artist", async () => {
    const ctx = await setup();
    const booking = (await requestVisit(ctx, { bookingDate: futureBookingDay(9) })).payload.data.booking;

    const moved = await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, time: "12:00" });
    expect(moved.ok).toBe(true);
    expect(moved.payload.data.booking.status).toBe(AWAITING);
    expect(moved.payload.data.booking.previous_time).toBe("10:00");
    // Moved again before the client answered: the client still sees the time they agreed to.
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, time: "13:00" })).ok).toBe(true);
    const seen = await clientRow(ctx, booking.id);
    expect(seen.status).toBe(AWAITING);
    expect(seen.previous_time).toBe("10:00");
    expect(seen.time).toBe("13:00");

    // The artists' copies moved with it and still wait.
    const [nailShare] = await myVisitShare(ctx.nail, ctx);
    expect(nailShare.time).toBe("13:00");
    expect(nailShare.status).toBe("درخواست");

    // Only the client can settle it.
    const approved = await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, status: "تایید شده" });
    expect(approved.status).toBe(409);
    expect(approved.payload.code).toBe("AWAITING_CLIENT");
    const stranger = createClient();
    await registerUser(stranger, { type: "client", name: "Someone Else" });
    expect((await answer(stranger, booking.id, true)).status).toBe(404);

    const accepted = await answer(ctx.clientClient, booking.id, true);
    expect(accepted.ok).toBe(true);
    expect(accepted.payload.data.booking.status).toBe("تایید شده");
    expect((await myVisitShare(ctx.nail, ctx)).map((b) => b.status)).toEqual(["تایید شده"]);
    expect((await myVisitShare(ctx.hair, ctx)).map((b) => b.status)).toEqual(["تایید شده"]);
    expect((await answer(ctx.clientClient, booking.id, true)).status).toBe(409);
  });

  it("declining the new time cancels the booking and frees the artists", async () => {
    const ctx = await setup();
    const booking = (await requestVisit(ctx, { bookingDate: futureBookingDay(10) })).payload.data.booking;
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, time: "12:00" })).ok).toBe(true);
    const declined = await answer(ctx.clientClient, booking.id, false);
    expect(declined.ok).toBe(true);
    expect(declined.payload.data.booking.status).toBe("لغو");
    expect(await myVisitShare(ctx.nail, ctx)).toHaveLength(0);
    expect(await myVisitShare(ctx.hair, ctx)).toHaveLength(0);
  });

  it("a single-service request waits too, and the client may still cancel it", async () => {
    const ctx = await setup();
    const day = futureBookingDay(11);
    const created = await ctx.clientClient.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, service: "کوتاهی ویزیت", bookingDate: day, time: "10:00",
      client: ctx.client.user.name, phone: ctx.client.phone
    });
    expect(created.status).toBe(201);
    const id = created.payload.data.booking.id;
    // Approved first, then moved: the confirmed time is what the client sees as before.
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id, status: "تایید شده" })).ok).toBe(true);
    const moved = await ctx.salonClient.patch("/api/salon-bookings", { id, time: "11:00" });
    expect(moved.payload.data.booking.status).toBe(AWAITING);
    // A change that does not touch the time does not ask again.
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id, staff: "" })).payload.data.booking.status).toBe(AWAITING);
    expect((await ctx.clientClient.post(`/api/salon-bookings/${id}/cancel`, {})).ok).toBe(true);
    expect((await clientRow(ctx, id)).status).toBe("لغو");
  });

  it("a booking the salon entered for a walk-in just moves", async () => {
    const ctx = await setup();
    const day = futureBookingDay(12);
    const created = await ctx.salonClient.post("/api/salon-bookings", {
      service: "کوتاهی ویزیت", bookingDate: day, time: "10:00", client: "حضوری", phone: "09120000091"
    });
    const moved = await ctx.salonClient.patch("/api/salon-bookings", { id: created.payload.data.booking.id, time: "11:00" });
    expect(moved.ok).toBe(true);
    expect(moved.payload.data.booking.status).toBe("تازه");
  });
});
