import { describe, it, expect } from "vitest";
import { futureBookingDay } from "./helpers.js";
import { newClient, newDirectArtist, newSalon, requestArtist, requestSalon } from "./afterVisitKit.js";

/** Owner's decision of 2026-10-25: a client may ask at most 60 days ahead; a salon or artist enters any date. */
describe("60 days ahead", () => {
  it("a client's request 70 days ahead is refused; 50 days ahead is fine; the salon itself may enter 70 days ahead", async () => {
    const ctx = await newSalon("Horizon");
    const client = await newClient("C Horizon");
    const far = futureBookingDay(62);
    const near = futureBookingDay(43);
    const tooFar = await requestSalon(ctx, client, { day: far });
    expect(tooFar.status).toBe(409);
    expect(tooFar.payload.error).toContain("۶۰ روز");
    const fine = await requestSalon(ctx, client, { day: near });
    expect(fine.status, JSON.stringify(fine.payload)).toBe(201);
    const own = await ctx.salonClient.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: far, time: "11:00", client: "عروس" });
    expect(own.ok, JSON.stringify(own.payload)).toBe(true);
  });

  it("the same for an independent artist", async () => {
    const a = await newDirectArtist("Horizon Artist");
    const client = await newClient("C Horizon Artist");
    const far = futureBookingDay(62);
    const tooFar = await requestArtist(a, client, { day: far });
    expect(tooFar.status).toBe(409);
  });
});
