import { describe, expect, it } from "vitest";
import { buildSuggestion, clock, formatLeft, toneFor } from "../../app/features/profile/storySuggestion.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

// 10:00 Tehran on a fixed day; times below are all after it.
const now = new Date("2026-10-31T06:30:00Z");
const todayKey = formatPersianDateKey(now);
const tomorrowKey = formatPersianDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
const days = [
  { label: "امروز", key: todayKey, times: ["13:00", "13:30", "18:00"] },
  { label: "فردا", key: tomorrowKey, times: ["09:00"] }
];

describe("story suggestion", () => {
  it("reads times in any digits", () => {
    expect(clock("۱۱:۰۰")).toBe("11:00");
    expect(clock("8:05")).toBe("08:05");
    expect(clock("")).toBe("");
  });

  it("says nothing when no time is free", () => {
    expect(buildSuggestion({ days: [{ label: "امروز", key: todayKey, times: [] }], now })).toBeNull();
  });

  it("offers today's free times first, with the time left to the nearest", () => {
    const result = buildSuggestion({ days, now });
    expect(result.kind).toBe("free");
    expect(result.title).toContain("امروز");
    expect(result.left).toBe(180);
    expect(result.tone).toBe("ok");
  });

  it("names a cancelled booking whose time is free again, with its team member", () => {
    const result = buildSuggestion({ days, cancelled: [{ status: "لغو", booking_date: todayKey, time: "۱۳:۳۰", staff: "نگار کاشی" }], now });
    expect(result.kind).toBe("freed");
    expect(result.title).toBe("نوبت نگار ساعت ۱۳:۳۰ لغو شد");
    expect(result.left).toBe(210);
  });

  it("ignores a cancelled booking whose time was booked again", () => {
    const result = buildSuggestion({ days, cancelled: [{ status: "لغو", booking_date: todayKey, time: "14:00" }], now });
    expect(result.kind).toBe("free");
  });

  it("finds a booking that vanished from the list and is free now", () => {
    const result = buildSuggestion({ days, vanished: [{ key: tomorrowKey, time: "09:00" }], now });
    expect(result.kind).toBe("freed");
    expect(result.title).toBe("نوبت فردا ساعت ۰۹:۰۰ آزاد شد");
    expect(result.tone).toBe("ok");
  });

  it("stays quiet when the freed time is already on today's story", () => {
    const posted = [`${todayKey}|13:00`, `${todayKey}|13:30`, `${todayKey}|18:00`, `${tomorrowKey}|09:00`];
    expect(buildSuggestion({ days, cancelled: [{ status: "لغو", booking_date: todayKey, time: "13:30" }], posted, now })).toBeNull();
  });

  it("calls a time that is not on the earlier story «تازه»", () => {
    const posted = [`${todayKey}|13:00`, `${todayKey}|18:00`, `${tomorrowKey}|09:00`];
    const result = buildSuggestion({ days, posted, now });
    expect(result.kind).toBe("new");
    expect(result.title).toContain("تازه");
    expect(result.keys).toEqual([`${todayKey}|13:30`]);
  });

  it("tones the time left, and writes it in words", () => {
    expect(toneFor(300)).toBe("ok");
    expect(toneFor(90)).toBe("soon");
    expect(toneFor(20)).toBe("late");
    expect(formatLeft(190)).toBe("۳ ساعت و ۱۰ دقیقه");
    expect(formatLeft(45)).toBe("۴۵ دقیقه");
    expect(formatLeft(120)).toBe("۲ ساعت");
  });
});

describe("story suggestion, under pressure", () => {
  // A small seeded generator so a failure can be replayed.
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pool = ["09:00", "09:30", "10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "15:30", "18:00", "19:30"];

  it("never offers a time that is not free, never a posted freed time, never negative time left (500 random worlds)", () => {
    const rand = rng(7);
    for (let round = 0; round < 500; round += 1) {
      const pick = (list, chance) => list.filter(() => rand() < chance);
      const world = [
        { label: "امروز", key: todayKey, times: pick(pool, 0.5).filter((t) => timeToMinutes(t) > 10 * 60 + 30) },
        { label: "فردا", key: tomorrowKey, times: pick(pool, 0.5) }
      ];
      const freeKeys = new Set(world.flatMap((day) => day.times.map((time) => `${day.key}|${time}`)));
      const everyKey = [...freeKeys, `${todayKey}|12:00`, `${tomorrowKey}|12:00`];
      const posted = pick(everyKey, 0.3);
      const cancelled = pick(everyKey, 0.4).map((entry) => { const [key, time] = entry.split("|"); return { status: "لغو", booking_date: key, time, staff: rand() < 0.5 ? "نگار کاشی" : "" }; });
      const vanished = pick(everyKey, 0.3).map((entry) => { const [key, time] = entry.split("|"); return { key, time }; });
      const result = buildSuggestion({ days: world, cancelled, vanished, posted, now });
      if (!result) {
        // Nothing offered means nothing free is news.
        expect([...freeKeys].every((key) => posted.includes(key))).toBe(true);
        continue;
      }
      expect(result.keys.length).toBeGreaterThan(0);
      for (const key of result.keys) {
        expect(freeKeys.has(key)).toBe(true);
        expect(posted.includes(key)).toBe(false);
      }
      expect(result.left).toBeGreaterThan(-1);
      expect(["ok", "soon", "late"]).toContain(result.tone);
      expect(result.title.length).toBeGreaterThan(5);
      if (result.kind === "freed") {
        const asked = new Set([...cancelled.filter((c) => c.status === "لغو").map((c) => `${c.booking_date}|${c.time}`), ...vanished.map((v) => `${v.key}|${v.time}`)]);
        for (const key of result.keys) expect(asked.has(key)).toBe(true);
      }
    }
  });

  it("puts the soonest freed time first and counts several", () => {
    const cancelled = [
      { status: "لغو", booking_date: todayKey, time: "18:00" },
      { status: "لغو", booking_date: todayKey, time: "13:00" },
      { status: "لغو", booking_date: tomorrowKey, time: "09:00" }
    ];
    const result = buildSuggestion({ days, cancelled, now });
    expect(result.kind).toBe("freed");
    expect(result.keys[0]).toBe(`${todayKey}|13:00`);
    expect(result.title).toContain("۳ وقت");
    expect(result.left).toBe(180);
  });

  it("treats a vanished booking and a cancelled one for the same time as one", () => {
    const result = buildSuggestion({
      days,
      cancelled: [{ status: "لغو", booking_date: todayKey, time: "13:00" }],
      vanished: [{ key: todayKey, time: "13:00" }],
      now
    });
    expect(result.keys).toEqual([`${todayKey}|13:00`]);
  });

  it("uses «لغو شد» only when every freed time was cancelled; any other mix says «آزاد شد»", () => {
    const both = buildSuggestion({ days, cancelled: [{ status: "لغو", booking_date: todayKey, time: "13:00" }], vanished: [{ key: tomorrowKey, time: "09:00" }], now });
    expect(both.title).toContain("آزاد شد");
    const only = buildSuggestion({ days, cancelled: [{ status: "لغو", booking_date: todayKey, time: "13:00" }, { status: "لغو", booking_date: tomorrowKey, time: "09:00" }], now });
    expect(only.title).toContain("لغو شد");
  });

  it("ignores bookings with other statuses and junk rows", () => {
    const result = buildSuggestion({
      days,
      cancelled: [{ status: "تایید شده", booking_date: todayKey, time: "13:00" }, null, {}, { status: "لغو" }],
      vanished: [{}, { key: todayKey }, { time: "13:00" }],
      now
    });
    expect(result.kind).toBe("free");
  });

  it("tones a freed time today by the hours left, and tomorrow is always roomy", () => {
    const late = new Date("2026-10-31T13:30:00Z"); // 17:00 Tehran
    const days2 = [{ label: "امروز", key: todayKey, times: ["17:30", "19:00", "21:00"] }, { label: "فردا", key: tomorrowKey, times: ["08:00"] }];
    expect(buildSuggestion({ days: days2, cancelled: [{ status: "لغو", booking_date: todayKey, time: "17:30" }], now: late }).tone).toBe("late");
    expect(buildSuggestion({ days: days2, cancelled: [{ status: "لغو", booking_date: todayKey, time: "19:00" }], now: late }).tone).toBe("soon");
    expect(buildSuggestion({ days: days2, cancelled: [{ status: "لغو", booking_date: todayKey, time: "21:00" }], now: late }).tone).toBe("ok");
    expect(buildSuggestion({ days: days2, cancelled: [{ status: "لغو", booking_date: tomorrowKey, time: "08:00" }], now: late }).tone).toBe("ok");
  });

  it("counts tomorrow's time left through midnight", () => {
    const late = new Date("2026-10-31T19:30:00Z"); // 23:00 Tehran
    const result = buildSuggestion({ days: [{ label: "امروز", key: todayKey, times: [] }, { label: "فردا", key: tomorrowKey, times: ["09:00"] }], now: late });
    expect(result.left).toBe(10 * 60);
  });
});

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

