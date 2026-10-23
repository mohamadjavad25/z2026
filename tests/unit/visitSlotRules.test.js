import { describe, it, expect } from "vitest";
import { visitSlotProblem } from "../../app/lib/visitSlotRules.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

// Iran has no DST since 2022 (UTC+03:30), so 06:30Z is 10:00 in Tehran.
const at = (isoUtc) => new Date(isoUtc);
const HOURS = [
  { day: "شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", active: true },
  { day: "یکشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", active: true },
  { day: "دوشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", active: true },
  { day: "سه‌شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", active: true },
  { day: "چهارشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", active: true },
  { day: "پنجشنبه", open_time: "۱۰:۰۰", close_time: "۱۸:۰۰", active: true },
  { day: "جمعه", open_time: "", close_time: "", active: false }
];
// 2026-10-14 is a Wednesday (چهارشنبه); 10:00 Tehran = 06:30Z.
const NOW = at("2026-10-14T06:30:00Z");
const today = formatPersianDateKey(NOW);
const tomorrow = formatPersianDateKey(at("2026-10-15T06:30:00Z")); // Thursday, closes 18:00
const friday = formatPersianDateKey(at("2026-10-16T06:30:00Z"));
const yesterday = formatPersianDateKey(at("2026-10-13T06:30:00Z"));

const check = (over) => visitSlotProblem({ hours: HOURS, bookingDateKey: tomorrow, time: "11:00", durationMinutes: 60, isClient: true, now: NOW, ...over });

describe("visitSlotProblem", () => {
  it("accepts an ordinary slot", () => {
    expect(check({})).toBeNull();
  });

  it("refuses a time that has started, for everyone", () => {
    expect(check({ bookingDateKey: today, time: "10:00" }).code).toBe("SLOT_PAST");
    expect(check({ bookingDateKey: today, time: "09:30", isClient: false }).code).toBe("SLOT_PAST");
    expect(check({ bookingDateKey: yesterday, time: "15:00", isClient: false }).code).toBe("SLOT_PAST");
    expect(check({ bookingDateKey: today, time: "10:00" }).status).toBe(409);
  });

  it("keeps a client 30 minutes away from now, but not the salon itself", () => {
    // 09:50 in Tehran: 10:00 is 10 minutes away, 10:30 is 40.
    const early = at("2026-10-14T06:20:00Z");
    expect(check({ bookingDateKey: today, time: "10:00", now: early }).code).toBe("TOO_SOON");
    expect(check({ bookingDateKey: today, time: "10:30", now: early })).toBeNull();
    expect(check({ bookingDateKey: today, time: "10:00", now: early, isClient: false })).toBeNull();
    // Exactly 30 minutes away is allowed (the lead is a minimum).
    expect(check({ bookingDateKey: today, time: "10:30", now: at("2026-10-14T06:30:00Z") })).toBeNull();
  });

  it("refuses a closed day", () => {
    expect(check({ bookingDateKey: friday }).code).toBe("SALON_CLOSED");
    expect(check({ bookingDateKey: friday, isClient: false }).error).toBe("سالن این روز تعطیله.");
  });

  it("refuses a visit that does not fit inside the opening hours", () => {
    // Thursday closes at 18:00: a 60-minute visit may start at 17:00 but not 17:30.
    expect(check({ time: "17:00" })).toBeNull();
    expect(check({ time: "17:30" }).code).toBe("OUTSIDE_HOURS");
    expect(check({ time: "09:30" }).code).toBe("OUTSIDE_HOURS");
    // A longer visit moves the last start earlier.
    expect(check({ time: "16:30", durationMinutes: 120 }).code).toBe("OUTSIDE_HOURS");
    expect(check({ time: "16:00", durationMinutes: 120 })).toBeNull();
  });

  it("treats a start that is not on the half-hour grid as outside", () => {
    expect(check({ time: "11:10" }).code).toBe("OUTSIDE_HOURS");
  });

  it("falls back to the default window when the salon has no row for the day", () => {
    expect(check({ hours: [], time: "10:00" })).toBeNull();
    expect(check({ hours: [], time: "20:00" }).code).toBe("OUTSIDE_HOURS");
  });

  it("answers in Persian", () => {
    for (const problem of [check({ bookingDateKey: today, time: "10:00" }), check({ bookingDateKey: friday }), check({ time: "09:30" }), check({ bookingDateKey: today, time: "10:00", now: at("2026-10-14T06:20:00Z") })]) {
      expect(problem.error).toMatch(/[؀-ۿ]/);
    }
  });
});
