import { describe, it, expect } from "vitest";
import { attendanceState, ownerAttendanceState, reliabilityView, ownReliabilityLine } from "../../app/shared/lib/attendance.js";
import { bookingStartMs } from "../../app/shared/lib/reminderTiming.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

const now = new Date("2026-10-27T08:00:00Z"); // 11:30 in Tehran

/** A booking `hours` after `now`, as stored (Persian date key, "HH:MM" Tehran). */
function at(hours, extra = {}) {
  const target = now.getTime() + hours * 3600e3;
  const minutes = (Math.floor(target / 60000) + 210) % 1440;
  const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  for (const shift of [-1, 0, 1]) {
    const date = formatPersianDateKey(new Date(target + shift * 86400e3));
    if (Math.abs(bookingStartMs(date, time, now) - target) < 60000) return { booking_date: date, time, status: "تایید شده", ...extra };
  }
  throw new Error("no slot");
}

describe("«میای؟»", () => {
  it("asks within the last day of a confirmed visit only", () => {
    expect(attendanceState(at(30), now)).toBe(null);
    expect(attendanceState(at(20), now)).toBe("ask");
    expect(attendanceState(at(1), now)).toBe("ask");
    expect(attendanceState(at(-1), now)).toBe(null);
    expect(attendanceState(at(5, { status: "درخواست" }), now)).toBe(null);
    expect(attendanceState(at(5, { status: "لغو" }), now)).toBe(null);
    expect(attendanceState(at(5, { proposal: { time: "12:00" } }), now)).toBe(null);
  });

  it("remembers a yes, even before the window", () => {
    expect(attendanceState(at(5, { client_confirmed_at: now.toISOString() }), now)).toBe("yes");
  });

  it("shows the salon or artist the answer for client accounts only", () => {
    expect(ownerAttendanceState(at(5, { client_user_id: 3 }), now)).toBe("waiting");
    expect(ownerAttendanceState(at(5, { client_user_id: 3, client_confirmed_at: "x" }), now)).toBe("yes");
    expect(ownerAttendanceState(at(5), now)).toBe(null);
    // A salon's own «تازه» is settled; an artist's «تازه» is still a request.
    expect(ownerAttendanceState(at(5, { client_user_id: 3, status: "تازه" }), now, "salon")).toBe("waiting");
    expect(ownerAttendanceState(at(5, { client_user_id: 3, status: "تازه" }), now, "artist")).toBe(null);
  });
});

describe("the client's record", () => {
  it("reads as words the salon understands", () => {
    expect(reliabilityView(null)).toBe(null);
    expect(reliabilityView({ came: 0, noShow: 0, recentNoShow: 0 }).line).toBe("اولین نوبتش توی فرفروئه.");
    expect(reliabilityView({ came: 4, noShow: 0, recentNoShow: 0 })).toMatchObject({ tone: "good", chip: "خوش‌قول", warn: "" });
    expect(reliabilityView({ came: 2, noShow: 0, recentNoShow: 0 }).chip).toBe("");
    expect(reliabilityView({ came: 5, noShow: 1, recentNoShow: 1 })).toMatchObject({ tone: "mid", chip: "۱ بار نیومده", warn: "" });
    const bad = reliabilityView({ came: 5, noShow: 3, recentNoShow: 2 });
    expect(bad.tone).toBe("bad");
    expect(bad.warn).toContain("۶ ماه");
  });

  it("tells the client their own record", () => {
    expect(ownReliabilityLine({ came: 0, noShow: 0 })).toBe("");
    expect(ownReliabilityLine({ came: 12, noShow: 0 })).toContain("۱۲ بار");
    expect(ownReliabilityLine({ came: 3, noShow: 2, recentNoShow: 2 })).toContain("زودتر لغو کن");
  });
});
