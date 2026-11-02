import { describe, it, expect } from "vitest";
import { activeNowBreak, breakDaysText, breakRangesOn, cleanBreakDays, weekdayOfDateKey } from "../../app/shared/lib/artistBreak.js";
import { formatPersianDateKey, getPersianWeekday, persianWeekdayIndex } from "../../app/shared/lib/persianCalendar.js";
import { isPublicArtistSlotBlocked } from "../../app/features/artist/bookingUtils.js";
import { bookingsInBreak, breakHourButtons } from "../../app/features/artist/ArtistBreakEditorModal.jsx";

const today = new Date();
const todayKey = formatPersianDateKey(today);
const todayIndex = persianWeekdayIndex(getPersianWeekday(today));
const tomorrow = new Date(today.getTime() + 86400000);
const tomorrowKey = formatPersianDateKey(tomorrow);
const tomorrowIndex = persianWeekdayIndex(getPersianWeekday(tomorrow));

describe("artist break (owner's decision 2026-11-02)", () => {
  it("knows the weekday of a date key", () => {
    expect(weekdayOfDateKey(todayKey)).toBe(todayIndex);
    expect(weekdayOfDateKey("not a day")).toBe(-1);
  });

  it("holds the daily window only on the days that are on", () => {
    const breakTime = { start: "13:00", end: "14:00", days: [todayIndex], now: null };
    expect(breakRangesOn(breakTime, todayKey)).toEqual([{ start: 780, end: 840 }]);
    expect(breakRangesOn(breakTime, tomorrowKey)).toEqual([]);
  });

  it("an old break without days still holds every day", () => {
    expect(breakRangesOn({ start: "۱۳:۰۰", end: "۱۴:۰۰" }, tomorrowKey)).toEqual([{ start: 780, end: 840 }]);
  });

  it("«الان استراحت می‌کنم» holds today only, and alone (no daily window)", () => {
    const breakTime = { start: "", end: "", days: [0, 1, 2, 3, 4, 5, 6], now: { date: todayKey, start: "10:05", end: "10:35" } };
    expect(breakRangesOn(breakTime, todayKey)).toEqual([{ start: 605, end: 635 }]);
    expect(breakRangesOn(breakTime, tomorrowKey)).toEqual([]);
    expect(activeNowBreak(breakTime, todayKey)).toEqual(breakTime.now);
    expect(activeNowBreak(breakTime, tomorrowKey)).toBeNull();
  });

  it("the artist's page blocks the same hours the server does", () => {
    const artist = { breakTime: { start: "13:00", end: "14:00", days: [tomorrowIndex] }, bookedSlots: [] };
    expect(isPublicArtistSlotBlocked(artist, tomorrowKey, "13:30", 30)).toBe(true);
    expect(isPublicArtistSlotBlocked(artist, tomorrowKey, "14:00", 30)).toBe(false);
    const otherDay = { breakTime: { start: "13:00", end: "14:00", days: [(tomorrowIndex + 1) % 7] }, bookedSlots: [] };
    expect(isPublicArtistSlotBlocked(otherDay, tomorrowKey, "13:30", 30)).toBe(false);
  });

  it("cleans and names the days", () => {
    expect(cleanBreakDays("6015")).toEqual([0, 1, 5, 6]);
    expect(cleanBreakDays([3, 3, 9, -1])).toEqual([3]);
    expect(breakDaysText([0, 1, 2, 3, 4, 5, 6])).toBe("هر روز");
    expect(breakDaysText([0, 1, 2, 3, 4, 5])).toBe("شنبه تا پنجشنبه");
    expect(breakDaysText([0, 6])).toBe("شنبه، جمعه");
  });
});

describe("break screen", () => {
  it("offers half-hour buttons inside the open days' hours", () => {
    const hours = [
      { day: "شنبه", open_time: "۱۰:۰۰", close_time: "۱۲:۰۰", active: true },
      { day: "جمعه", open_time: "۰۸:۰۰", close_time: "۲۲:۰۰", active: false }
    ];
    expect(breakHourButtons(hours)).toEqual(["۱۰:۰۰", "۱۰:۳۰", "۱۱:۰۰", "۱۱:۳۰", "۱۲:۰۰"]);
    expect(breakHourButtons([])[0]).toBe("۰۸:۰۰");
  });

  it("names upcoming bookings inside the new window, and keeps cancelled and other days out", () => {
    const bookings = [
      { dateKey: tomorrowKey, date: "فردا", time: "13:30", durationMinutes: 30, client: "سارا", status: "تایید شد" },
      { dateKey: tomorrowKey, date: "فردا", time: "15:00", durationMinutes: 30, client: "مینا", status: "تایید شد" },
      { dateKey: tomorrowKey, date: "فردا", time: "13:00", durationMinutes: 30, client: "لغوی", status: "لغو" }
    ];
    const inside = bookingsInBreak(bookings, { start: "13:00", end: "14:00", days: [tomorrowIndex] }, todayKey);
    expect(inside.map((item) => item.client)).toEqual(["سارا"]);
    expect(bookingsInBreak(bookings, { start: "13:00", end: "14:00", days: [(tomorrowIndex + 1) % 7] }, todayKey)).toEqual([]);
  });
});
