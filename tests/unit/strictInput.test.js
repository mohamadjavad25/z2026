import { describe, it, expect } from "vitest";
import { parseBookingTime } from "../../app/shared/lib/time.js";
import { parsePersianDateKey, resolveRollingPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { parseBoundedInt, parseRequestedMinutes } from "../../app/lib/validation/numbers.js";
import { strictDayKey } from "../../app/lib/validation/bookingSlot.js";
import { priceProblem, durationProblem } from "../../app/lib/validation/service.js";

const from = new Date("2026-10-21T10:00:00Z");

describe("strict clock time", () => {
  it("accepts H:MM / HH:MM in any digits and gives HH:MM", () => {
    expect(parseBookingTime("۱۱:۳۰ ")).toBe("11:30");
    expect(parseBookingTime("9:05")).toBe("09:05");
    expect(parseBookingTime("٠٩:٥٩")).toBe("09:59");
  });
  it("refuses everything else", () => {
    for (const bad of ["24:00", "10:60", "11:00:00", "11", "1100", "abc", "", " ", "11:", ":30", "1e3:00", 1100, null, ["11:00"]]) {
      expect(parseBookingTime(bad), String(bad)).toBe("");
    }
  });
});

describe("strict Jalali dates", () => {
  it("reads real days, also in other digits", () => {
    expect(parsePersianDateKey("1405-08-12", from)).toBe("1405-08-12");
    expect(parsePersianDateKey("۱۴۰۵/۰۸/۱۲", from)).toBe("1405-08-12");
  });
  it("returns an empty key for impossible, out-of-range and Gregorian dates, never today", () => {
    for (const bad of ["1405-13-01", "1405-02-32", "1405-07-31", "1405-00-10", "0000-00-00", "1300-01-01", "2026-10-25", "نه تاریخ"]) {
      expect(resolveRollingPersianDateKey(bad, from), bad).toBe("");
    }
  });
  it("the booking APIs only take YYYY-MM-DD (or a day name)", () => {
    expect(strictDayKey("1405-08-12")).not.toBe("");
    expect(strictDayKey("1405/08/12")).toBe("");
    expect(strictDayKey("1405-8-12")).toBe("");
    expect(strictDayKey("امروز")).not.toBe("");
    expect(strictDayKey("garbage")).toBe("");
  });
});

describe("bounded integers", () => {
  it("takes whole numbers in number or digit text", () => {
    expect(parseBoundedInt("۴۵", { min: 1, max: 720 })).toEqual({ ok: true, value: 45 });
    expect(parseBoundedInt(30, { min: 1, max: 720 })).toEqual({ ok: true, value: 30 });
  });
  it("refuses NaN, text, fractions, negatives and out-of-range", () => {
    for (const bad of [NaN, Infinity, "abc", "1e3", "0x10", "12abc", 1.5, "1.5", -1, "-1", 721, [], {}, null, undefined]) {
      expect(parseBoundedInt(bad, { min: 0, max: 720 }).ok, String(bad)).toBe(false);
    }
  });
  it("appointment length: absent is fine, junk is refused, odd sizes are clamped to 15..720", () => {
    expect(parseRequestedMinutes({})).toEqual({ ok: true, minutes: undefined });
    expect(parseRequestedMinutes({ durationMinutes: 0 })).toEqual({ ok: true, minutes: undefined });
    expect(parseRequestedMinutes({ durationMinutes: 5 })).toEqual({ ok: true, minutes: 15 });
    expect(parseRequestedMinutes({ duration_minutes: 100000 })).toEqual({ ok: true, minutes: 720 });
    for (const bad of ["abc", -30, 90.5, "NaN", [], {}]) expect(parseRequestedMinutes({ durationMinutes: bad }).ok, String(bad)).toBe(false);
  });
});

describe("service price and duration text", () => {
  it("keeps normal owner-written prices and durations", () => {
    for (const price of ["100", "۳۵۰٬۰۰۰", "از ۶۵۰ هزار", "رایگان", "از ۳.۸ م", ""]) expect(priceProblem(price), price).toBeNull();
    for (const duration of ["۴۵ دقیقه", "60 دقیقه", "", "۱۸۰ دقیقه"]) expect(durationProblem(duration), duration).toBeNull();
  });
  it("refuses negative, huge and absurdly long ones", () => {
    for (const price of ["-5", "-۱۰۰", "9".repeat(20), "x".repeat(100), 5e12]) expect(priceProblem(price), String(price)).not.toBeNull();
    for (const duration of ["abc", "-30", "۳۰۰۰۰ دقیقه", "0 دقیقه", "x".repeat(100)]) expect(durationProblem(duration), duration).not.toBeNull();
  });
});
