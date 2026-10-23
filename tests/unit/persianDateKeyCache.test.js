import { describe, it, expect } from "vitest";
import { formatPersianDateKey, persianDateKeyToDate, resolveRollingPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

/** Reading a stored day back into a Date walks day by day with Intl; every booking row of an artist is read for each availability question, so the answer is remembered (found under load: 50 parallel availability reads on a salon with 1500 bookings hung for 30 s). */
describe("persianDateKeyToDate keeps its answers", () => {
  const day = (n, from) => { const d = new Date(from); d.setDate(d.getDate() + n); return d; };

  it("gives the same day for the same key, also on repeat, and a fresh Date each time", () => {
    const from = new Date();
    for (const n of [-200, -1, 1, 3, 60, 300]) {
      const key = formatPersianDateKey(day(n, from));
      const first = persianDateKeyToDate(key, from);
      const again = persianDateKeyToDate(key, from);
      expect(formatPersianDateKey(first)).toBe(key);
      expect(again.getTime()).toBe(first.getTime());
      expect(again).not.toBe(first);
      first.setDate(first.getDate() + 5);
      expect(formatPersianDateKey(persianDateKeyToDate(key, from))).toBe(key);
    }
  });

  it("still says no to a day out of range and to a day that does not exist, repeatedly", () => {
    const from = new Date();
    const far = formatPersianDateKey(day(900, from));
    expect(persianDateKeyToDate(far, from)).toBeNull();
    expect(persianDateKeyToDate(far, from)).toBeNull();
    expect(persianDateKeyToDate(far, from, 1000)).not.toBeNull();
    expect(resolveRollingPersianDateKey("1405-13-45", from)).toBe("");
  });

  it("a long list of stored days resolves quickly (1600 rows of 60 distinct days)", () => {
    const from = new Date();
    const keys = Array.from({ length: 1600 }, (_, i) => formatPersianDateKey(day(1 + (i % 60), from)));
    const started = Date.now();
    for (const key of keys) expect(resolveRollingPersianDateKey(key, from)).toBe(key);
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
