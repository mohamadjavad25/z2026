import { describe, it, expect } from "vitest";
import { getBookingTimelinePhase } from "../../app/features/artist/bookingUtils.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

const now = new Date("2026-10-08T15:00:00Z"); // 18:30 Tehran
const todayKey = formatPersianDateKey(now);
const shiftKey = (delta) => formatPersianDateKey(new Date(now.getTime() + delta * 86400000));

describe("booking timeline phase", () => {
  it("treats a past absolute date as done, even when its weekday name matches an upcoming one", () => {
    expect(getBookingTimelinePhase({ dateKey: shiftKey(-3), time: "۱۴:۳۰" }, { now })).toBe("done");
  });

  it("treats a future absolute date as upcoming", () => {
    expect(getBookingTimelinePhase({ dateKey: shiftKey(2), time: "۰۹:۰۰" }, { now })).toBe("upcoming");
  });

  it("uses the clock for today", () => {
    expect(getBookingTimelinePhase({ dateKey: todayKey, time: "۱۰:۰۰" }, { now, durationMinutes: 60 })).toBe("done");
    expect(getBookingTimelinePhase({ dateKey: todayKey, time: "۱۸:۰۰" }, { now, durationMinutes: 60 })).toBe("live");
    expect(getBookingTimelinePhase({ dateKey: todayKey, time: "۲۰:۰۰" }, { now })).toBe("upcoming");
  });
});
