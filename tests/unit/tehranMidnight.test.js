import { describe, it, expect } from "vitest";
import { formatPersianDateKey, formatRelativeBookingDayLabel, resolveRollingPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { isSlotInPast } from "../../app/shared/lib/slots.js";

/**
 * Between midnight and 03:30 in Tehran a machine set to UTC (Vercel) is still on the day before. «امروز» and «فردا»
 * must follow Tehran's day there too: they used to start from the machine's own midnight, so «فردا» meant today.
 * The moments below are fixed instants, so the test means the same on a machine in any time zone.
 */
describe("today and tomorrow follow Tehran's day, whatever the machine's clock", () => {
  // Monday 1405-08-04 00:28 in Tehran = 2026-10-25 20:58 UTC, the day before; then the same day at 03:00, 12:00 and 23:50.
  const moments = ["2026-10-25T20:58:00Z", "2026-10-25T23:30:00Z", "2026-10-26T08:30:00Z", "2026-10-26T20:20:00Z"];

  it("«امروز», «فردا» and «پس‌فردا» are Tehran's today, tomorrow and the day after", () => {
    for (const iso of moments) {
      const now = new Date(iso);
      expect(formatPersianDateKey(now), iso).toBe("1405-08-04");
      expect(resolveRollingPersianDateKey("امروز", now), iso).toBe("1405-08-04");
      expect(resolveRollingPersianDateKey("فردا", now), iso).toBe("1405-08-05");
      expect(resolveRollingPersianDateKey("پس‌فردا", now), iso).toBe("1405-08-06");
    }
  });

  it("a stored day reads back as «امروز» / «فردا» on Tehran's day", () => {
    for (const iso of moments) {
      const now = new Date(iso);
      expect(formatRelativeBookingDayLabel("1405-08-04", now), iso).toBe("امروز");
      expect(formatRelativeBookingDayLabel("1405-08-05", now), iso).toBe("فردا");
    }
  });

  it("a weekday name means the next such day in Tehran (today when it is that day)", () => {
    const now = new Date(moments[0]); // Tehran: Monday (دوشنبه) 1405-08-04, just after midnight
    expect(resolveRollingPersianDateKey("دوشنبه", now)).toBe("1405-08-04");
    expect(resolveRollingPersianDateKey("سه‌شنبه", now)).toBe("1405-08-05");
    expect(isSlotInPast("فردا", "00:10", now)).toBe(false);
    expect(isSlotInPast("امروز", "00:10", now)).toBe(true);
  });
});
