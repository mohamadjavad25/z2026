import { describe, it, expect } from "vitest";
import {
  NEAR_BOOKING_HOURS, blockedByNearText, blockedTeamText, cancelledByProviderText, handoverProposalText, isProposalLapsed,
  minutesToStart, proposalDeadlineMs, proposalView, providerLabel, shortClock, startsSoon, timeProposalText
} from "../../app/shared/lib/providerRules.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

// 2026-10-05 06:00 UTC = 09:30 in Tehran.
const NOW = new Date("2026-10-05T06:00:00Z");
const TODAY = formatPersianDateKey(new Date("2026-10-05T12:00:00Z"));
const IN_3_DAYS = formatPersianDateKey(new Date("2026-10-08T12:00:00Z"));

describe("owner's rules of 2026-10-22: texts", () => {
  it("says the exact sentences the owner approved", () => {
    expect(blockedByNearText(2)).toBe("۲ مشتری تا ۲۴ ساعت دیگه نوبت دارن. تا این نوبت‌ها انجام یا لغو نشن، نمی‌شه حساب رو پاک کرد.");
    expect(blockedTeamText(1)).toContain("از تیم بیرون رفت");
    expect(blockedTeamText(1, true)).toContain("از تیم برداشت");
    expect(cancelledByProviderText("salon", "شیدا")).toBe("سالن شیدا نوبتت رو لغو کرد. ببخشید که این‌طوری شد؛ یه نوبت دیگه از فرفرو بگیر.");
    expect(timeProposalText("salon", "شیدا", shortClock("10:00"), shortClock("12:00"))).toBe("سالن شیدا می‌خواد نوبتت رو از ۱۰ ببره به ۱۲. قبول می‌کنی؟");
    expect(handoverProposalText("salon", "شیدا", "مینا", "سارا")).toContain("از مینا به سارا");
  });

  it("does not repeat the word «سالن» when the name already has it", () => {
    expect(providerLabel("salon", "سالن شیدا")).toBe("سالن شیدا");
    expect(providerLabel("artist", "")).toBe("آرتیست");
  });

  it("writes a time on the hour as one number and others with minutes", () => {
    expect(shortClock("10:00")).toBe("۱۰");
    expect(shortClock("۱۰:۳۰")).toBe("۱۰:۳۰");
  });
});

describe("the 24-hour window and the proposal deadline", () => {
  it("startsSoon is true only for a booking ahead and within 24 hours", () => {
    expect(NEAR_BOOKING_HOURS).toBe(24);
    expect(startsSoon(TODAY, "15:00", NOW)).toBe(true); // 5.5 h
    expect(startsSoon(TODAY, "09:00", NOW)).toBe(false); // already started
    expect(startsSoon(IN_3_DAYS, "10:00", NOW)).toBe(false);
    expect(minutesToStart(TODAY, "11:30", NOW)).toBe(120);
  });

  it("a proposal lasts 6 hours, or until 2 hours before the booking, whichever is earlier", () => {
    const madeAt = NOW.toISOString();
    // booking far away: 6 hours
    expect(proposalDeadlineMs({ proposalAt: madeAt, bookingDate: IN_3_DAYS, time: "10:00" }, NOW)).toBe(NOW.getTime() + 6 * 3600 * 1000);
    // booking at 12:30 Tehran (3 h from now): 2 hours before = 1 hour from now
    expect(proposalDeadlineMs({ proposalAt: madeAt, bookingDate: TODAY, time: "12:30" }, NOW)).toBe(NOW.getTime() + 3600 * 1000);
    expect(isProposalLapsed({ proposal_at: madeAt, booking_date: IN_3_DAYS, time: "10:00" }, new Date(NOW.getTime() + 5 * 3600 * 1000))).toBe(false);
    expect(isProposalLapsed({ proposal_at: madeAt, booking_date: IN_3_DAYS, time: "10:00" }, new Date(NOW.getTime() + 6 * 3600 * 1000))).toBe(true);
    // an unreadable proposal counts as lapsed (it is closed, never offered)
    expect(isProposalLapsed({ proposal_at: null })).toBe(true);
  });

  it("the screens only see an open proposal", () => {
    const row = { proposal_at: NOW.toISOString(), proposal_date: IN_3_DAYS, proposal_time: "14:00", proposal_staff: "", booking_date: IN_3_DAYS, time: "10:00" };
    expect(proposalView(row, NOW)).toMatchObject({ date: IN_3_DAYS, time: "14:00" });
    expect(proposalView(row, new Date(NOW.getTime() + 7 * 3600 * 1000))).toBeNull();
    expect(proposalView({ proposal_at: null }, NOW)).toBeNull();
  });
});
