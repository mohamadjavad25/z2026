import { describe, it, expect } from "vitest";
import { durationTextMinutes } from "../../app/shared/lib/time.js";
import { toLatinDigits } from "../../app/shared/lib/digits.js";
import { eveningForEarlyVisit, waitsForMorning } from "../../app/shared/lib/reminderTiming.js";
import { leaveDayAfter } from "../../app/features/team/teamWeek.js";

describe("a service length written in words", () => {
  it.each([
    ["دو ساعت", 120], ["سه ساعت", 180], ["دو ساعت و نیم", 150], ["نیم‌ساعت", 30], ["یک ساعت و ربع", 75],
    ["چهل و پنج دقیقه", 45], ["دو ساعت و بیست دقیقه", 140], ["۲ ساعت و ۳۰ دقیقه", 150], ["۴۵", 45], ["۱:۳۰", 90]
  ])("%s is %i minutes", (text, minutes) => {
    expect(durationTextMinutes(text)).toBe(minutes);
  });
});

it("an Arabic keyboard can type a number", () => {
  expect(toLatinDigits("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
  expect(toLatinDigits("۰۹۱۲")).toBe("0912");
});

describe("a visit before the morning window", () => {
  const tehran = (hour) => new Date(Date.UTC(2026, 10, 9, hour) - 3.5 * 3600000);
  it("gets its one reminder in the evening, not also at eight", () => {
    expect(eveningForEarlyVisit("day", "07:00", tehran(8))).toBe(null);
    expect(eveningForEarlyVisit("day", "07:00", tehran(20))).toBe("evening");
  });
  it("a later visit is left alone", () => {
    expect(eveningForEarlyVisit("day", "12:00", tehran(14))).toBe("day");
  });
});

describe("reminders wait for eight", () => {
  const tehran = (hour) => new Date(Date.UTC(2026, 10, 9, hour) - 3.5 * 3600000);
  it("a visit from ten on waits; an earlier visit has no later moment", () => {
    expect(waitsForMorning("15:00", tehran(6))).toBe(true);
    expect(waitsForMorning("10:00", tehran(7))).toBe(true);
    expect(waitsForMorning("09:30", tehran(7))).toBe(false);
    expect(waitsForMorning("15:00", tehran(8))).toBe(false);
  });
});

it("«فردا» for a leave is tomorrow in Tehran, also just after midnight there", () => {
  expect(leaveDayAfter(1, new Date("2026-11-08T21:00:00Z"))).toBe("2026-11-10");
});
