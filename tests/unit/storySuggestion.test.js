import { describe, expect, it } from "vitest";
import {
  NEAR_MINUTES,
  STORY_MAX_DAYS,
  STORY_TIMES_PER_DAY,
  buildSuggestion,
  clock,
  spreadTimes,
  suggestDays,
  suggestTimes,
  toggleDay,
  toggleTime,
  usableTimes
} from "../../app/features/profile/storySuggestion.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

// 10:00 Tehran (06:30 UTC) on a fixed day.
const NOW = new Date("2026-11-01T06:30:00Z");
const DAY = 24 * 60 * 60 * 1000;
const key = (offset) => formatPersianDateKey(new Date(NOW.getTime() + offset * DAY));
const day = (offset, times, label = ["امروز", "فردا", "پس‌فردا"][offset]) => ({ label, key: key(offset), times });

describe("story: the times frfro suggests (owner 2026-11-01: we only suggest)", () => {
  it("reads every way a time is written as one", () => {
    expect(clock("۰۸:۰۵")).toBe("08:05");
    expect(clock("8:05")).toBe("08:05");
    expect(clock("8:5")).toBe("");
  });

  it("never offers a time less than an hour away, and nothing already past", () => {
    const times = usableTimes(day(0, ["09:00", "10:30", "11:00", "11:30", "18:00"]), NOW);
    expect(times).toEqual(["11:00", "11:30", "18:00"]);
    expect(NEAR_MINUTES).toBe(60);
  });

  it("keeps every time on later days, sorted and once each", () => {
    expect(usableTimes(day(1, ["16:00", "09:00", "۰۹:۰۰", "12:00"]), NOW)).toEqual(["09:00", "12:00", "16:00"]);
  });

  it("goes by the day's key, not its label, so a list read before midnight stays right", () => {
    // Read yesterday, labelled «فردا», but that day is today now: its early times are gone.
    expect(usableTimes({ label: "فردا", key: key(0), times: ["09:00", "12:00"] }, NOW)).toEqual(["12:00"]);
  });

  it("spreads four times over the day: first and last in, never four in a row", () => {
    const all = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"];
    const picked = spreadTimes(all);
    expect(picked).toHaveLength(STORY_TIMES_PER_DAY);
    expect(picked[0]).toBe("09:00");
    expect(picked[picked.length - 1]).toBe("18:00");
    expect(picked).toEqual([...picked].sort());
    expect(new Set(picked).size).toBe(picked.length);
  });

  it("takes them all when there are four or fewer", () => {
    expect(spreadTimes(["14:00", "11:00"])).toEqual(["11:00", "14:00"]);
    expect(spreadTimes([])).toEqual([]);
  });

  it("starts with the first two days that still have a time", () => {
    const days = [day(0, ["09:00"]), day(1, ["12:00"]), day(2, ["15:00"])];
    // Today's only time is gone, so tomorrow and the day after.
    expect(suggestDays(days, NOW)).toEqual([key(1), key(2)]);
    expect(Object.keys(suggestTimes(days, NOW))).toEqual([key(1), key(2)]);
  });

  it("suggests nothing when no day has a time", () => {
    expect(suggestDays([day(0, []), day(1, []), day(2, [])], NOW)).toEqual([]);
  });
});

describe("story: what the owner changes", () => {
  const order = [key(0), key(1), key(2)];

  it("turns days on and off, at most two, in calendar order", () => {
    expect(toggleDay([], key(1), order)).toEqual([key(1)]);
    expect(toggleDay([key(1)], key(0), order)).toEqual([key(0), key(1)]);
    expect(toggleDay([key(0), key(1)], key(1), order)).toEqual([key(0)]);
  });

  it("a third day replaces the one picked first, so two stay on", () => {
    const next = toggleDay([key(0), key(1)], key(2), order);
    expect(next).toEqual([key(1), key(2)]);
    expect(next.length).toBeLessThanOrEqual(STORY_MAX_DAYS);
  });

  it("turns times on and off, and refuses a fifth", () => {
    let list = [];
    for (const t of ["09:00", "11:00", "13:00", "15:00"]) list = toggleTime(list, t);
    expect(list).toEqual(["09:00", "11:00", "13:00", "15:00"]);
    expect(toggleTime(list, "17:00")).toEqual(list);
    expect(toggleTime(list, "11:00")).toEqual(["09:00", "13:00", "15:00"]);
  });

  it("holds its limits whatever the taps (500 random sessions)", () => {
    let seed = 7;
    const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const times = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
    for (let run = 0; run < 500; run += 1) {
      let days = [];
      let on = [];
      for (let tap = 0; tap < 30; tap += 1) {
        if (rand(2)) days = toggleDay(days, order[rand(3)], order);
        else on = toggleTime(on, times[rand(times.length)]);
        expect(days.length).toBeLessThanOrEqual(STORY_MAX_DAYS);
        expect(new Set(days).size).toBe(days.length);
        expect(days).toEqual([...days].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
        expect(on.length).toBeLessThanOrEqual(STORY_TIMES_PER_DAY);
        expect(new Set(on).size).toBe(on.length);
      }
    }
  });
});

describe("story: the card on the owner's home", () => {
  it("says today's free times first", () => {
    const s = buildSuggestion({ days: [day(0, ["12:00", "15:00"]), day(1, ["10:00"])], now: NOW });
    expect(s).toMatchObject({ when: "امروز", count: 2, title: "امروز ۲ وقت خالی داری" });
  });

  it("says tomorrow when today has nothing left an hour ahead", () => {
    const s = buildSuggestion({ days: [day(0, ["10:30"]), day(1, ["10:00", "12:00", "16:00"])], now: NOW });
    expect(s).toMatchObject({ when: "فردا", count: 3, title: "فردا ۳ وقت خالی داری" });
  });

  it("never mentions the day after (the card is about now)", () => {
    expect(buildSuggestion({ days: [day(0, []), day(1, []), day(2, ["10:00"])], now: NOW })).toBeNull();
  });

  it("rests for the rest of the day once a story was made", () => {
    expect(buildSuggestion({ days: [day(0, ["12:00"])], postedToday: true, now: NOW })).toBeNull();
  });

  it("is quiet when nothing is free", () => {
    expect(buildSuggestion({ days: [], now: NOW })).toBeNull();
  });
});
