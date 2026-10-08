import { describe, it, expect } from "vitest";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { timeLabelToMinutes } from "../../app/shared/lib/time.js";

describe("salon staff calendars", () => {
  it("gives the salon its linked artist's break and own bookings (times only), matching what the server refuses", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Calendar Salon" });
    await salonClient.get("/api/salon-hours");
    const artistClient = createClient();
    await registerUser(artistClient, { type: "artist", name: "Calendar Artist" });
    expect((await artistClient.post("/api/artist/join-salon", { salonUserId: salon.user.id })).ok).toBe(true);

    const day = futureBookingDay(2);
    expect((await artistClient.post("/api/artist/me", { kind: "break", startTime: "۱۳:۰۰", endTime: "۱۴:۰۰" })).ok).toBe(true);
    const own = await artistClient.post("/api/artist/me", {
      kind: "booking",
      client: "Private Customer",
      phone: "09120000000",
      service: "کوتاهی مو",
      date: day,
      time: "۱۵:۰۰"
    });
    expect(own.ok).toBe(true);

    const res = await salonClient.get("/api/salon-staff/calendars");
    expect(res.ok).toBe(true);
    const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
    const calendar = res.payload.data.calendars.find((item) => item.staff === staff[0].name);
    expect(calendar.breakTime).toEqual({ start: "۱۳:۰۰", end: "۱۴:۰۰" });
    expect(calendar.bookedSlots.some((slot) => slot.booking_date === day && timeLabelToMinutes(slot.time) === 15 * 60)).toBe(true);
    // Only when/how long, never who.
    expect(JSON.stringify(res.payload)).not.toContain("Private Customer");
    expect(JSON.stringify(res.payload)).not.toContain("09120000000");

    // The same time is exactly what the server refuses for that artist.
    const clash = await salonClient.post("/api/salon-bookings", {
      service: "کوتاهی مو",
      staff: staff[0].name,
      bookingDate: day,
      time: "۱۵:۰۰",
      client: "Walk-in"
    });
    expect(clash.status).toBe(409);
  });

  it("is for salons only", async () => {
    const clientClient = createClient();
    await registerUser(clientClient, { type: "client", name: "Nosy Client" });
    const res = await clientClient.get("/api/salon-staff/calendars");
    expect(res.ok).toBe(false);
  });
});
