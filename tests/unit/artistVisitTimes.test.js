import { describe, it, expect } from "vitest";
import { artistBusySlots, artistVisitTimes } from "../../app/features/booking/artistVisitTimes.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { timeLabelToMinutes } from "../../app/shared/lib/time.js";

// 2026-10-14 12:00 in Tehran is 08:30Z (UTC+03:30).
const NOW = new Date("2026-10-14T08:30:00Z");
const today = formatPersianDateKey(NOW);
const later = formatPersianDateKey(new Date("2026-10-16T08:30:00Z"));
const minutesOf = (times) => times.map(timeLabelToMinutes);

describe("artistVisitTimes", () => {
  it("offers the whole grid on a future day, 09:00 up to the last start that fits before 21:00", () => {
    const times = minutesOf(artistVisitTimes({ day: later, minutes: 60, bookings: [], now: NOW }));
    expect(times[0]).toBe(9 * 60);
    expect(times.at(-1)).toBe(20 * 60);
    expect(times).toHaveLength(23);
  });

  it("a longer visit has fewer starts at the end of the day", () => {
    const times = minutesOf(artistVisitTimes({ day: later, minutes: 150, bookings: [], now: NOW }));
    expect(times.at(-1)).toBe(18 * 60 + 30);
  });

  it("today starts a quarter of an hour after now", () => {
    // 12:00 now: 12:00 and 12:15 are too close, 12:30 is fine.
    const times = minutesOf(artistVisitTimes({ day: today, minutes: 30, bookings: [], now: NOW }));
    expect(times[0]).toBe(12 * 60 + 30);
  });

  it("leaves out the break and every booking that overlaps the visit, not only one that starts at the same time", () => {
    const bookings = [
      { date: later, time: "۱۰:۰۰", durationMinutes: 60, status: "تایید" },
      { date: later, time: "۱۴:۰۰", durationMinutes: 30, status: "تایید شده" }
    ];
    const times = minutesOf(artistVisitTimes({ day: later, minutes: 60, bookings, breakTime: { start: "۱۳:۰۰", end: "۱۴:۰۰" }, now: NOW }));
    // 10:00 booking blocks 09:30 (ends 10:30), 10:00, 10:30 (starts inside) no: 10:30 start is free.
    for (const blocked of [9 * 60 + 30, 10 * 60, 12 * 60 + 30, 13 * 60, 13 * 60 + 30, 14 * 60]) expect(times, String(blocked)).not.toContain(blocked);
    for (const free of [9 * 60, 11 * 60, 12 * 60, 14 * 60 + 30]) expect(times, String(free)).toContain(free);
  });

  it("ignores cancelled and expired bookings, and bookings on other days", () => {
    const bookings = [
      { date: later, time: "۱۰:۰۰", durationMinutes: 60, status: "لغو" },
      { date: later, time: "۱۱:۰۰", durationMinutes: 60, status: "منقضی شده" },
      { date: today, time: "۱۵:۰۰", durationMinutes: 60, status: "تایید" }
    ];
    const times = minutesOf(artistVisitTimes({ day: later, minutes: 60, bookings, now: NOW }));
    expect(times).toContain(10 * 60);
    expect(times).toContain(11 * 60);
    expect(times).toContain(15 * 60);
  });

  it("is an empty list, not an error, when the day is full", () => {
    const bookings = [{ date: later, time: "۰۹:۰۰", durationMinutes: 12 * 60, status: "تایید" }];
    expect(artistVisitTimes({ day: later, minutes: 30, bookings, now: NOW })).toEqual([]);
  });

  it("copes with no list and no break at all", () => {
    expect(artistVisitTimes({ day: later, minutes: 30, now: NOW }).length).toBeGreaterThan(0);
    expect(artistBusySlots(undefined)).toEqual([]);
    expect(artistBusySlots(null)).toEqual([]);
  });

  it("describes a booking by its day, start and length", () => {
    expect(artistBusySlots([{ date: later, time: "۱۰:۰۰", durationMinutes: 45, status: "تایید" }])).toEqual([{ booking_date: later, time: "۱۰:۰۰", duration_minutes: 45 }]);
  });
});
