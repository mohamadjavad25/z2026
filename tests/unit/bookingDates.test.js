import { describe, it, expect, afterEach, vi } from "vitest";
import { buildExactBookingDateTabs, buildExactBookingDateTabsCentered } from "../../app/features/artist/bookingUtils.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { isSlotInPast } from "../../app/shared/lib/slots.js";

// Dates here are Tehran's (UTC+3:30, no daylight saving) whatever zone the phone is in. Tehran midnight is 20:30 UTC.
const keysOf = (tabs) => tabs.map((tab) => tab.dateKey);
const originalTz = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz;
});

function at(iso) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("the week of day chips", () => {
  it("flips to the next day exactly at Tehran midnight", () => {
    at("2026-05-01T20:29:59Z");
    const before = keysOf(buildExactBookingDateTabs(2));
    at("2026-05-01T20:30:00Z");
    const after = keysOf(buildExactBookingDateTabs(2));
    expect(after[0]).toBe(before[1]);
  });

  it("crosses the end of a Persian year: 29 Esfand 1404 is followed by 1 Farvardin 1405", () => {
    at("2026-03-20T10:00:00Z");
    const keys = keysOf(buildExactBookingDateTabs(4));
    expect(keys).toContain("1404-12-29");
    expect(keys[keys.indexOf("1404-12-29") + 1]).toBe("1405-01-01");
  });

  it("knows the leap year: 1403 has a 30 Esfand", () => {
    at("2025-03-18T10:00:00Z");
    const keys = keysOf(buildExactBookingDateTabs(5));
    expect(keys).toContain("1403-12-30");
    expect(keys[keys.indexOf("1403-12-30") + 1]).toBe("1404-01-01");
  });

  it("never repeats or skips a day, at any hour of two years, in any phone time zone", () => {
    for (const zone of ["UTC", "Asia/Tehran", "America/New_York", "Europe/Berlin", "Pacific/Auckland"]) {
      process.env.TZ = zone;
      // every 30 minutes around Tehran midnight, plus a spread of other hours, over the zone's clock changes
      for (const base of [Date.parse("2026-03-01T00:00:00Z"), Date.parse("2026-10-20T00:00:00Z"), Date.parse("2027-03-10T00:00:00Z")]) {
        for (let step = 0; step < 24 * 40; step += 1) {
          vi.useFakeTimers();
          vi.setSystemTime(new Date(base + step * 30 * 60000));
          const keys = keysOf(buildExactBookingDateTabs(7));
          expect(new Set(keys).size, `${zone} ${new Date(base + step * 30 * 60000).toISOString()}`).toBe(7);
          expect(keys[0]).toBe(formatPersianDateKey(new Date()));
          for (let i = 1; i < keys.length; i += 1) {
            expect(keys[i] > keys[i - 1] || keys[i].slice(0, 4) !== keys[i - 1].slice(0, 4)).toBe(true);
            expect(keys[i], `${zone} step ${step}`).toBe(formatPersianDateKey(new Date(Date.now() + i * 86400000)));
          }
        }
      }
    }
  });

  it("the centered week keeps today in the middle", () => {
    at("2026-05-01T12:00:00Z");
    const tabs = buildExactBookingDateTabsCentered(3, 3);
    expect(tabs).toHaveLength(7);
    expect(tabs[3].dateKey).toBe(formatPersianDateKey(new Date()));
    expect(tabs[3].offset).toBe(0);
  });
});

describe("a time that has already passed today", () => {
  it("is judged by Tehran's clock, not the server's", () => {
    // 19:00 UTC is 22:30 in Tehran
    at("2026-05-01T19:00:00Z");
    expect(isSlotInPast(formatPersianDateKey(new Date()), "22:00")).toBe(true);
    expect(isSlotInPast(formatPersianDateKey(new Date()), "23:00")).toBe(false);
  });

  it("just after Tehran midnight the early hours of the new day are not yet passed... until they are", () => {
    at("2026-05-01T20:40:00Z"); // 00:10 Tehran, a new day
    const today = formatPersianDateKey(new Date());
    expect(isSlotInPast(today, "00:00")).toBe(true);
    expect(isSlotInPast(today, "09:00")).toBe(false);
  });
});
