import { describe, it, expect } from "vitest";
import { bookingStartMs, dueReminderKind } from "../../app/shared/lib/reminderTiming.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

// A fixed "now": 2026-10-05 06:00 UTC = 09:30 in Tehran (UTC+03:30, no daylight saving).
const NOW = new Date("2026-10-05T06:00:00Z");
const TODAY = formatPersianDateKey(new Date("2026-10-05T12:00:00Z"));
const TOMORROW = formatPersianDateKey(new Date("2026-10-06T12:00:00Z"));

describe("reminder timing", () => {
  it("reads the start instant in Tehran time", () => {
    // 12:00 Tehran = 08:30 UTC
    expect(bookingStartMs(TODAY, "12:00", NOW)).toBe(Date.parse("2026-10-05T08:30:00Z"));
    expect(bookingStartMs(TODAY, "۱۲:۰۰", NOW)).toBe(Date.parse("2026-10-05T08:30:00Z"));
  });

  it("is due 'soon' within two hours", () => {
    expect(dueReminderKind(TODAY, "11:00", NOW)).toBe("soon"); // 1.5h away
  });

  it("is due 'day' between two and twenty-four hours", () => {
    expect(dueReminderKind(TODAY, "15:00", NOW)).toBe("day"); // 5.5h away
    expect(dueReminderKind(TOMORROW, "09:00", NOW)).toBe("day"); // 23.5h away
  });

  it("is not due when past or more than a day away", () => {
    expect(dueReminderKind(TODAY, "09:00", NOW)).toBeNull();
    expect(dueReminderKind(TOMORROW, "10:00", NOW)).toBeNull(); // 24.5h away
  });

  it("ignores unreadable input", () => {
    expect(dueReminderKind("نامعتبر", "12:00", NOW)).toBeNull();
    expect(dueReminderKind(TODAY, "", NOW)).toBeNull();
  });
});
