import { describe, it, expect } from "vitest";
import {
  bookingHoldsSlot,
  bookingIsOnDateKey,
  findSalonHourForDateKey,
  isSalonHourOpen,
  salonDayWindow,
  weekdayOfDateKey
} from "../../app/shared/lib/salonAvailability.js";

// 1405-07-16 is Thursday 16 Mehr 1405 (8 Oct 2026); 1405-07-17 Friday, 1405-07-18 Saturday.
const hours = [
  { day: "شنبه", open_time: "۱۴:۰۰", close_time: "۲۰:۰۰", active: 1 },
  { day: "پنج‌شنبه", open_time: "۱۰:۰۰", close_time: "۱۸:۰۰", active: true },
  { day: "جمعه", open_time: "", close_time: "", active: 0 }
];

describe("salon availability", () => {
  it("finds a day's hours by date, whatever the spacing of the weekday name", () => {
    expect(weekdayOfDateKey("1405-07-16")).toBe("پنجشنبه");
    expect(findSalonHourForDateKey(hours, "1405-07-16")?.close_time).toBe("۱۸:۰۰");
    expect(findSalonHourForDateKey(hours, "1405-07-18")?.open_time).toBe("۱۴:۰۰");
  });

  it("treats an inactive day as closed and a missing day as open on the default window", () => {
    expect(isSalonHourOpen(findSalonHourForDateKey(hours, "1405-07-17"))).toBe(false);
    const missing = findSalonHourForDateKey(hours, "1405-07-19");
    expect(missing).toBeNull();
    expect(isSalonHourOpen(missing)).toBe(true);
    expect(salonDayWindow(missing)).toEqual({ open: "۱۰:۰۰", close: "۲۰:۰۰" });
  });

  it("matches only bookings on that exact date that still hold their slot (same as the server)", () => {
    expect(bookingIsOnDateKey({ booking_date: "1405-07-16" }, "1405-07-16")).toBe(true);
    expect(bookingIsOnDateKey({ booking_date: "امروز" }, "1405-07-16")).toBe(false);
    expect(bookingHoldsSlot({ status: "تایید شده" })).toBe(true);
    expect(bookingHoldsSlot({ status: "لغو" })).toBe(false);
    expect(bookingHoldsSlot({ status: "منقضی شده" })).toBe(false);
  });
});
