import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildUpcomingWeekDays, getTodayPersianWeekday } from "../../app/shared/lib/time.js";
import { formatPersianDateKey, resolveRollingPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { todayStatus } from "../../app/shared/lib/openingHours.js";

// 00:13 on Saturday in Iran, still Friday on a phone set to another country: when the error of 2026-11-07 was reported.
const SATURDAY_IN_IRAN = new Date("2026-11-06T20:43:30Z");
const WEEK = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

describe("«امروز» is the day in Iran, whatever the phone's clock is set to", () => {
  const before = process.env.TZ;
  beforeEach(() => { process.env.TZ = "America/New_York"; });
  afterEach(() => { process.env.TZ = before; });

  it("names the day in Iran", () => {
    expect(getTodayPersianWeekday(SATURDAY_IN_IRAN)).toBe("شنبه");
  });

  it("gives every day the exact name the hours rows are stored under", () => {
    const start = Date.UTC(2026, 10, 7, 8); // a Saturday, midday in Iran
    const names = WEEK.map((_, index) => getTodayPersianWeekday(new Date(start + index * 86400000)));
    expect(names).toEqual(WEEK);
  });

  it("the card's open/closed line reads the day in Iran", () => {
    const hours = [
      { day: "جمعه", active: false, open_time: "", close_time: "" },
      { day: "شنبه", active: true, open_time: "۱۰:۰۰", close_time: "۲۰:۰۰" }
    ];
    expect(todayStatus(hours, SATURDAY_IN_IRAN)).toEqual({ open: true, label: "باز تا ۲۰:۰۰" });
  });
});

describe("the booking day strip on a phone set to another country's time", () => {
  const before = process.env.TZ;
  afterEach(() => { process.env.TZ = before; vi.useRealTimers(); });

  // Each label is tapped and read back into a date: it must be the same day it says, starting with today in Iran.
  // Behind Iran the phone still says Friday; ahead of it, on a Saturday afternoon in Iran, it already says Sunday.
  it.each([
    ["America/New_York", SATURDAY_IN_IRAN],
    ["Pacific/Kiritimati", new Date("2026-11-07T12:00:00Z")]
  ])("%s: seven days from today in Iran, each meaning the date it shows", (zone, now) => {
    process.env.TZ = zone;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const days = buildUpcomingWeekDays(7);
    expect(days[0].startsWith("شنبه ")).toBe(true);
    const keys = days.map((_, index) => formatPersianDateKey(new Date(now.getTime() + index * 86400000)));
    expect(days.map((day) => resolveRollingPersianDateKey(day))).toEqual(keys);
  });
});
