import { describe, expect, it } from "vitest";
import { buildSuggestion, clock, formatLeft, toneFor } from "../../app/features/profile/storySuggestion.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

// 10:00 Tehran on a fixed day; times below are all after it.
const now = new Date("2026-10-31T06:30:00Z");
const todayKey = formatPersianDateKey(now);
const tomorrowKey = formatPersianDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
const days = [
  { label: "امروز", key: todayKey, times: ["13:00", "13:30", "18:00"] },
  { label: "فردا", key: tomorrowKey, times: ["09:00"] }
];

describe("story suggestion", () => {
  it("reads times in any digits", () => {
    expect(clock("۱۱:۰۰")).toBe("11:00");
    expect(clock("8:05")).toBe("08:05");
    expect(clock("")).toBe("");
  });

  it("says nothing when no time is free", () => {
    expect(buildSuggestion({ days: [{ label: "امروز", key: todayKey, times: [] }], now })).toBeNull();
  });

  it("offers today's free times first, with the time left to the nearest", () => {
    const result = buildSuggestion({ days, now });
    expect(result.kind).toBe("free");
    expect(result.title).toContain("امروز");
    expect(result.left).toBe(180);
    expect(result.tone).toBe("ok");
  });

  it("names a cancelled booking whose time is free again, with its team member", () => {
    const result = buildSuggestion({ days, cancelled: [{ status: "لغو", booking_date: todayKey, time: "۱۳:۳۰", staff: "نگار کاشی" }], now });
    expect(result.kind).toBe("freed");
    expect(result.title).toBe("نوبت نگار ساعت ۱۳:۳۰ لغو شد");
    expect(result.left).toBe(210);
  });

  it("ignores a cancelled booking whose time was booked again", () => {
    const result = buildSuggestion({ days, cancelled: [{ status: "لغو", booking_date: todayKey, time: "14:00" }], now });
    expect(result.kind).toBe("free");
  });

  it("finds a booking that vanished from the list and is free now", () => {
    const result = buildSuggestion({ days, vanished: [{ key: tomorrowKey, time: "09:00" }], now });
    expect(result.kind).toBe("freed");
    expect(result.title).toBe("نوبت فردا ساعت ۰۹:۰۰ آزاد شد");
    expect(result.tone).toBe("ok");
  });

  it("stays quiet when the freed time is already on today's story", () => {
    const posted = [`${todayKey}|13:00`, `${todayKey}|13:30`, `${todayKey}|18:00`, `${tomorrowKey}|09:00`];
    expect(buildSuggestion({ days, cancelled: [{ status: "لغو", booking_date: todayKey, time: "13:30" }], posted, now })).toBeNull();
  });

  it("calls a time that is not on the earlier story «تازه»", () => {
    const posted = [`${todayKey}|13:00`, `${todayKey}|18:00`, `${tomorrowKey}|09:00`];
    const result = buildSuggestion({ days, posted, now });
    expect(result.kind).toBe("new");
    expect(result.title).toContain("تازه");
    expect(result.keys).toEqual([`${todayKey}|13:30`]);
  });

  it("tones the time left, and writes it in words", () => {
    expect(toneFor(300)).toBe("ok");
    expect(toneFor(90)).toBe("soon");
    expect(toneFor(20)).toBe("late");
    expect(formatLeft(190)).toBe("۳ ساعت و ۱۰ دقیقه");
    expect(formatLeft(45)).toBe("۴۵ دقیقه");
    expect(formatLeft(120)).toBe("۲ ساعت");
  });
});
