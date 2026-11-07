import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTodayPersianWeekday } from "../../app/shared/lib/time.js";
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
