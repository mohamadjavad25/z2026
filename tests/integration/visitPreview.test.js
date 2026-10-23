import { describe, it, expect } from "vitest";
import { createClient, joinSalonAsArtist, registerUser, futureBookingDay } from "./helpers.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

const M = "مانیکور پیش‌نمایش"; // 45 min, only the nail artist
const H = "کوتاهی پیش‌نمایش"; // 30 min, only the hair artist

// A salon with a nail artist and a hair artist (each linked to one service) and a few clients.
async function setup({ clients = 1 } = {}) {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Preview Salon" });
  await salonClient.get("/api/salon-hours");
  const joinAs = async (name) => {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name });
    expect((await joinSalonAsArtist(client, salonClient, salon.user.id)).ok).toBe(true);
    return { client, user };
  };
  const nail = await joinAs("Preview Nail Artist");
  const hair = await joinAs("Preview Hair Artist");
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
  const staffOf = (artist) => staff.find((person) => Number(person.artist_user_id) === Number(artist.user.id));
  nail.staff = staffOf(nail);
  hair.staff = staffOf(hair);
  const addService = async (name, duration, person) => {
    const created = await salonClient.post("/api/salon-services", { name, price: "300", duration });
    expect(created.ok).toBe(true);
    const linked = await salonClient.patch("/api/salon-services", { id: created.payload.data.service.id, name, staff_ids: [String(person.id)] });
    expect(linked.ok).toBe(true);
  };
  await addService(M, "۴۵ دقیقه", nail.staff);
  await addService(H, "۳۰ دقیقه", hair.staff);
  const customers = [];
  for (let i = 0; i < clients; i += 1) {
    const clientClient = createClient();
    const client = await registerUser(clientClient, { type: "client", name: `Preview Client ${i}` });
    customers.push({ client: clientClient, user: client.user, phone: client.phone });
  }
  return { salonClient, salon, nail, hair, customers, customer: customers[0] };
}

function previewUrl(ctx, { day, time, services = [M, H], minutes = [], staff = [] }) {
  const query = new URLSearchParams({ salonUserId: String(ctx.salon.user.id), day, time });
  services.forEach((service) => query.append("service", service));
  minutes.forEach((value) => query.append("minutes", String(value)));
  staff.forEach((value) => query.append("staff", value));
  return `/api/salon-bookings/preview?${query}`;
}

const dateKeyOnWeekday = (weekday) => {
  const day = new Date();
  for (let i = 0; i < 8; i += 1) {
    day.setDate(day.getDate() + 1);
    if (getPersianWeekday(day) === weekday) return formatPersianDateKey(day);
  }
  throw new Error("no such weekday");
};

describe("GET /api/salon-bookings/preview", () => {
  it("shows a client who does what and when, without the schedule behind it", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const res = await ctx.customer.client.get(previewUrl(ctx, { day, time: "10:00" }));
    expect(res.status).toBe(200);
    const data = res.payload.data;
    expect(data.ok).toBe(true);
    expect(data.durationMinutes).toBe(75);
    expect(data.end).toBe(10 * 60 + 75);
    expect(data.parts).toEqual([
      { service: M, minutes: 45, start: "10:00", end: "10:45", staff: ctx.nail.staff.name },
      { service: H, minutes: 30, start: "10:45", end: "11:15", staff: ctx.hair.staff.name }
    ]);
  });

  it("takes the time in Persian digits too, and ignores any artist a client names", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const res = await ctx.customer.client.get(previewUrl(ctx, { day, time: "۱۰:۰۰", staff: [ctx.hair.staff.name, ctx.nail.staff.name] }));
    expect(res.payload.data.ok).toBe(true);
    expect(res.payload.data.parts.map((part) => part.staff)).toEqual([ctx.nail.staff.name, ctx.hair.staff.name]);
  });

  it("gives the salon its artist picker: free, skilled and away for every team member", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const res = await ctx.salonClient.get(previewUrl(ctx, { day, time: "10:00" }));
    expect(res.payload.data.ok).toBe(true);
    const [manicure, haircut] = res.payload.data.parts;
    const byName = (part, name) => part.options.find((option) => option.name === name);
    expect(manicure.options).toHaveLength(2);
    expect(byName(manicure, ctx.nail.staff.name)).toMatchObject({ free: true, skilled: true, away: "" });
    expect(byName(manicure, ctx.hair.staff.name)).toMatchObject({ free: true, skilled: false, away: "" });
    expect(byName(haircut, ctx.hair.staff.name)).toMatchObject({ free: true, skilled: true });
    expect(manicure.free).toBe(true);
  });

  it("lets the salon name any team member, and says when that artist is busy or not on the team", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const handOver = await ctx.salonClient.get(previewUrl(ctx, { day, time: "10:00", staff: [ctx.hair.staff.name, ""] }));
    expect(handOver.payload.data.ok).toBe(true);
    expect(handOver.payload.data.parts[0].staff).toBe(ctx.hair.staff.name);
    // The hair artist also holds the haircut from 10:45, so the manicure hand-over still fits.
    expect(handOver.payload.data.parts[1].staff).toBe(ctx.hair.staff.name);

    // The hair artist takes a walk-in at 10:00; naming them for the manicure at 10:00 is refused.
    expect((await ctx.salonClient.post("/api/salon-bookings", { service: H, staff: ctx.hair.staff.name, bookingDate: day, time: "10:00", client: "حضوری" })).ok).toBe(true);
    const busy = await ctx.salonClient.get(previewUrl(ctx, { day, time: "10:00", staff: [ctx.hair.staff.name, ""] }));
    expect(busy.status).toBe(200);
    expect(busy.payload.data).toMatchObject({ ok: false, code: "STAFF_BUSY", partIndex: 0 });
    expect(busy.payload.data.message).toContain(ctx.hair.staff.name);
    expect(busy.payload.data.parts[0].free).toBe(false);

    const unknown = await ctx.salonClient.get(previewUrl(ctx, { day, time: "12:00", staff: ["ناشناس", ""] }));
    expect(unknown.payload.data).toMatchObject({ ok: false, code: "UNKNOWN_STAFF", partIndex: 0 });
  });

  it("refuses a client visit that would leave a service without a free artist", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    // The only hair artist works 11:00-11:30, right where the haircut (10:45-11:15) would be.
    expect((await ctx.salonClient.post("/api/salon-bookings", { service: H, staff: ctx.hair.staff.name, bookingDate: day, time: "11:00", client: "حضوری" })).ok).toBe(true);
    const res = await ctx.customer.client.get(previewUrl(ctx, { day, time: "10:00" }));
    expect(res.payload.data).toMatchObject({ ok: false, code: "NO_FREE_ARTIST", partIndex: 1 });
    expect(res.payload.data.message).toContain(H);
    // A slot that does fit is fine.
    expect((await ctx.customer.client.get(previewUrl(ctx, { day, time: "12:00" }))).payload.data.ok).toBe(true);
  });

  it("answers a slot the salon cannot take with the reason, as the booking itself would", async () => {
    const ctx = await setup();
    const friday = await ctx.customer.client.get(previewUrl(ctx, { day: dateKeyOnWeekday("جمعه"), time: "10:00" }));
    expect(friday.status).toBe(200);
    expect(friday.payload.data).toMatchObject({ ok: false, code: "SALON_CLOSED", parts: [] });
    expect(friday.payload.data.message).toBe("سالن این روز تعطیله.");

    const late = await ctx.customer.client.get(previewUrl(ctx, { day: futureBookingDay(2, { notOn: ["پنجشنبه"] }), time: "19:30" }));
    expect(late.payload.data).toMatchObject({ ok: false, code: "OUTSIDE_HOURS" });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const past = await ctx.salonClient.get(previewUrl(ctx, { day: formatPersianDateKey(yesterday), time: "10:00" }));
    expect(past.payload.data).toMatchObject({ ok: false, code: "SLOT_PAST" });
  });

  it("is a refusal, not a crash, for every kind of bad request", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const get = (url, who = ctx.customer.client) => who.get(url);
    const nine = Array.from({ length: 9 }, (_, i) => `خدمت ${i}`);
    expect((await get(previewUrl(ctx, { day: "", time: "10:00" }))).status).toBe(400);
    for (const time of ["", "abc", "25:99", "9", "10:0", "10:60", "-1:30", "10:30:00"]) {
      expect((await get(previewUrl(ctx, { day, time }))).status, `time ${time}`).toBe(400);
    }
    expect((await get(previewUrl(ctx, { day, time: "10:00", services: [] }))).status).toBe(400);
    expect((await get(previewUrl(ctx, { day, time: "10:00", services: nine, minutes: nine.map(() => 30) }))).status).toBe(400);
    expect((await get(previewUrl(ctx, { day, time: "10:00", services: [M, "x".repeat(121)] }))).status).toBe(400);
    expect((await get(previewUrl(ctx, { day, time: "10:00", services: [M, "خدمت ناشناس"] }))).status).toBe(400);
    expect((await get("/api/salon-bookings/preview?day=" + day + "&time=10:00&service=" + encodeURIComponent(M))).status).toBe(400);
    const nowhere = await get(previewUrl({ salon: { user: { id: 999999 } } }, { day, time: "10:00" }));
    expect(nowhere.status).toBe(404);
    // An unlisted service is planned when its length is given (same as the availability list).
    const unlisted = await get(previewUrl(ctx, { day, time: "10:00", services: [M, "خدمت ناشناس"], minutes: [45, 30] }));
    expect(unlisted.status).toBe(200);
    expect(unlisted.payload.data.durationMinutes).toBe(75);
  });

  it("is for clients and the salon itself only", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const anonymous = await createClient().get(previewUrl(ctx, { day, time: "10:00" }));
    expect(anonymous.status).toBe(401);
    const artist = await ctx.nail.client.get(previewUrl(ctx, { day, time: "10:00" }));
    expect(artist.status).toBe(403);
    const otherSalon = createClient();
    await registerUser(otherSalon, { type: "salon", name: "Other Salon" });
    expect((await otherSalon.get(previewUrl(ctx, { day, time: "10:00" }))).status).toBe(403);
  });

  it("books exactly what it showed: the salon's chosen artists land in the booking and their calendars", async () => {
    const ctx = await setup();
    const day = futureBookingDay(3);
    // Hand the manicure to the hair artist, keep the haircut with them too.
    const shown = (await ctx.salonClient.get(previewUrl(ctx, { day, time: "10:00", staff: [ctx.hair.staff.name, ctx.hair.staff.name] }))).payload.data;
    expect(shown.ok).toBe(true);
    const created = await ctx.salonClient.post("/api/salon-bookings", {
      bookingDate: day, time: "10:00", client: "حضوری", phone: "09120000555", service: "x",
      parts: shown.parts.map((part) => ({ service: part.service, staff: part.staff }))
    });
    expect(created.status).toBe(201);
    const parts = JSON.parse(created.payload.data.booking.parts);
    expect(parts.map((part) => [part.service, part.minutes, part.staff])).toEqual(shown.parts.map((part) => [part.service, part.minutes, part.staff]));
    expect(created.payload.data.booking.status).toBe("تازه");
    expect(Number(created.payload.data.booking.duration_minutes)).toBe(shown.durationMinutes);
    // Both services are the hair artist's, back to back: one block in their calendar.
    const mine = (await ctx.hair.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "حضوری");
    expect(mine).toHaveLength(1);
    expect(Number(mine[0].duration_minutes)).toBe(75);
    expect((await ctx.nail.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "حضوری")).toHaveLength(0);
    // And the same time is now refused in the preview.
    const again = await ctx.salonClient.get(previewUrl(ctx, { day, time: "10:30", staff: [ctx.hair.staff.name, ""] }));
    expect(again.payload.data.ok).toBe(false);
  });
});

describe("preview and booking never disagree", () => {
  it("for a client, a time the preview accepts is booked and one it refuses is refused, across a busy day", async () => {
    const ctx = await setup({ clients: 8 });
    const day = futureBookingDay(4, { notOn: ["پنجشنبه"] });
    // A busy day: bookings for each artist at scattered times.
    const walkIn = (service, staff, time, phone) => ctx.salonClient.post("/api/salon-bookings", { service, staff, bookingDate: day, time, client: "حضوری", phone });
    for (const [service, staff, time, phone] of [
      [M, ctx.nail.staff.name, "10:00", "09120001001"],
      [H, ctx.hair.staff.name, "11:30", "09120001002"],
      [M, ctx.nail.staff.name, "13:00", "09120001003"],
      [H, ctx.hair.staff.name, "14:00", "09120001004"],
      [H, ctx.hair.staff.name, "16:30", "09120001005"]
    ]) {
      expect((await walkIn(service, staff, time, phone)).ok, `${service} ${time}`).toBe(true);
    }
    const combos = [[M, H], [H, M], [M], [H]];
    const times = [];
    for (let minutes = 9 * 60 + 30; minutes <= 19 * 60 + 30; minutes += 30) {
      times.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
    }
    let accepted = 0;
    let refused = 0;
    let turn = 0;
    for (const services of combos) {
      for (const time of times) {
        const customer = ctx.customers[turn % ctx.customers.length];
        turn += 1;
        const shown = (await customer.client.get(previewUrl(ctx, { day, time, services }))).payload.data;
        const booked = await customer.client.post("/api/salon-bookings", {
          salonUserId: ctx.salon.user.id, bookingDate: day, time, client: customer.user.name, phone: customer.phone,
          service: services.join(" + "),
          ...(services.length > 1 ? { parts: services.map((service) => ({ service })) } : {})
        });
        const label = `${services.join("+")} @ ${time}`;
        if (shown.ok) {
          expect(booked.status, `${label} ${JSON.stringify(booked.payload)}`).toBe(201);
          accepted += 1;
          const row = booked.payload.data.booking;
          if (services.length > 1) {
            expect(JSON.parse(row.parts).map((part) => part.staff), label).toEqual(shown.parts.map((part) => part.staff));
          } else {
            expect(row.staff, label).toBe(shown.parts[0].staff);
          }
          // Free the slot again so every combination is judged against the same day.
          expect((await ctx.salonClient.patch("/api/salon-bookings", { id: row.id, status: "لغو", action: "cancel" })).ok, label).toBe(true);
        } else {
          expect(booked.status, `${label} (${shown.code})`).toBe(409);
          if (shown.code === "SLOT_PAST" || shown.code === "TOO_SOON" || shown.code === "SALON_CLOSED" || shown.code === "OUTSIDE_HOURS") {
            expect(booked.payload.error, label).toBe(shown.message);
          }
          refused += 1;
        }
      }
    }
    // The day really did exercise both answers.
    expect(accepted).toBeGreaterThan(20);
    expect(refused).toBeGreaterThan(10);
  });

  it("for the salon, naming artists: accepted previews are booked, refused ones are refused", async () => {
    const ctx = await setup();
    const day = futureBookingDay(5, { notOn: ["پنجشنبه"] });
    expect((await ctx.salonClient.post("/api/salon-bookings", { service: M, staff: ctx.nail.staff.name, bookingDate: day, time: "11:00", client: "حضوری", phone: "09120002001" })).ok).toBe(true);
    const nail = ctx.nail.staff.name;
    const hair = ctx.hair.staff.name;
    // At most 19 bookings per minute per salon (the booking route's own throttle), so a hand-picked spread.
    const cases = [
      ["10:00", nail, hair], ["10:00", hair, nail], ["10:00", hair, hair], ["10:00", "", ""],
      ["10:30", nail, hair], ["10:30", hair, ""], ["10:30", "", hair],
      ["11:00", nail, hair], ["11:00", hair, hair], ["11:00", hair, nail], ["11:00", "", ""],
      ["11:30", nail, hair], ["11:30", hair, nail],
      ["12:00", nail, nail], ["12:00", nail, hair], ["15:00", hair, hair], ["15:00", nail, ""]
    ];
    let accepted = 0;
    for (const [time, first, second] of cases) {
      const shown = (await ctx.salonClient.get(previewUrl(ctx, { day, time, staff: [first, second] }))).payload.data;
      const booked = await ctx.salonClient.post("/api/salon-bookings", {
        bookingDate: day, time, client: "حضوری", phone: "09120002002", service: "x",
        parts: [{ service: M, staff: first }, { service: H, staff: second }]
      });
      const label = `${time} [${first}|${second}] preview=${JSON.stringify({ ok: shown.ok, code: shown.code })} post=${booked.status} ${JSON.stringify(booked.payload.error)}`;
      expect(booked.status === 201, label).toBe(shown.ok);
      if (booked.status === 201) {
        accepted += 1;
        expect((await ctx.salonClient.patch("/api/salon-bookings", { id: booked.payload.data.booking.id, status: "لغو", action: "cancel" })).ok, label).toBe(true);
      }
    }
    expect(accepted).toBeGreaterThan(5);
    expect(accepted).toBeLessThan(cases.length);
  });
});

describe("two people booking the same visit at once", () => {
  it("lets exactly one through and tells the other the time is taken", async () => {
    const ctx = await setup({ clients: 4 });
    const day = futureBookingDay(6);
    const request = (customer) => customer.client.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, bookingDate: day, time: "10:00", client: customer.user.name, phone: customer.phone,
      service: "x", parts: [{ service: M }, { service: H }]
    });
    const results = await Promise.all(ctx.customers.map(request));
    const created = results.filter((res) => res.status === 201);
    expect(results.every((res) => res.status === 201 || res.status === 409), JSON.stringify(results.map((r) => r.status))).toBe(true);
    expect(created).toHaveLength(1);
    // The artists' calendars hold one visit each, not one per attempt.
    for (const artist of [ctx.nail, ctx.hair]) {
      const share = (await artist.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name.startsWith("Preview Client"));
      expect(share).toHaveLength(1);
    }
  });
});

describe("booking days never double up", () => {
  it("a single-service request for the same slot, sent twice at once, is accepted once", async () => {
    const ctx = await setup({ clients: 4 });
    const day = futureBookingDay(7);
    const results = await Promise.all(ctx.customers.map((customer) => customer.client.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, bookingDate: day, time: "10:00", client: customer.user.name, phone: customer.phone, service: H
    })));
    expect(results.every((res) => res.status === 201 || res.status === 409), JSON.stringify(results.map((r) => r.status))).toBe(true);
    expect(results.filter((res) => res.status === 201)).toHaveLength(1);
    const share = (await ctx.hair.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name.startsWith("Preview Client"));
    expect(share).toHaveLength(1);
  });

  it("an independent artist's slot taken by two clients at once goes to one of them", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Solo Artist", menu: [["ابرو", "30 دقیقه"]] });
    const day = futureBookingDay(8);
    const clients = [];
    for (let i = 0; i < 4; i += 1) {
      const client = createClient();
      const user = await registerUser(client, { type: "client", name: `Solo Client ${i}` });
      clients.push({ client, user });
    }
    const results = await Promise.all(clients.map(({ client, user }) => client.post("/api/artist/bookings", {
      artistUserId: artist.user.id, service: "ابرو", bookingDate: day, time: "11:00", durationMinutes: 30, client: user.user.name, phone: user.phone
    })));
    expect(results.every((res) => res.status === 201 || res.status === 409), JSON.stringify(results.map((r) => r.status))).toBe(true);
    expect(results.filter((res) => res.status === 201)).toHaveLength(1);
  });

  it("a salon booking holds the artist's calendar for the service's own length, not an hour", async () => {
    const ctx = await setup();
    const day = futureBookingDay(9);
    const walkIn = await ctx.salonClient.post("/api/salon-bookings", { service: H, staff: ctx.hair.staff.name, bookingDate: day, time: "10:00", client: "حضوری", phone: "09120003001" });
    expect(walkIn.status).toBe(201);
    const [share] = (await ctx.hair.client.get("/api/artist/me")).payload.data.bookings.filter((b) => b.client_name === "حضوری");
    expect(Number(share.duration_minutes)).toBe(30);
    // So the half hour right after is still the artist's to give: a request for 10:30 goes through.
    const next = await ctx.customer.client.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, bookingDate: day, time: "10:30", client: ctx.customer.user.name, phone: ctx.customer.phone, service: H
    });
    expect(next.status).toBe(201);
  });
});

