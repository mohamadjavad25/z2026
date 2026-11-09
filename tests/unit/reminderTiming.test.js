import { describe, it, expect } from "vitest";
import { bookingStartMs, dueReminderKind, eveningForEarlyVisit } from "../../app/shared/lib/reminderTiming.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

// A fixed "now": 2026-10-05 06:00 UTC = 09:30 in Tehran (UTC+03:30, no daylight saving).
const NOW = new Date("2026-10-05T06:00:00Z");
const TODAY = formatPersianDateKey(new Date("2026-10-05T12:00:00Z"));
const TOMORROW = formatPersianDateKey(new Date("2026-10-06T12:00:00Z"));

describe("a visit before 8:00 is reminded the evening before", () => {
  const atTehran = (hh, mm = 0) => new Date(Date.UTC(2026, 9, 5, hh, mm - 210));

  it("the day reminder becomes the evening one between 20:00 and 22:00", () => {
    expect(eveningForEarlyVisit("day", "06:00", atTehran(20))).toBe("evening");
    expect(eveningForEarlyVisit("day", "۰۷:۳۰", atTehran(21, 50))).toBe("evening");
  });

  it("outside those hours, for a later visit, and for the two-hour one nothing changes", () => {
    expect(eveningForEarlyVisit("day", "06:00", atTehran(19, 50))).toBe(null); // held for the evening, one text not two
    expect(eveningForEarlyVisit("day", "06:00", atTehran(22))).toBe("day");
    expect(eveningForEarlyVisit("day", "08:00", atTehran(20))).toBe("day");
    expect(eveningForEarlyVisit("soon", "06:00", atTehran(20))).toBe("soon");
    expect(eveningForEarlyVisit(null, "06:00", atTehran(20))).toBe(null);
  });
});

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
