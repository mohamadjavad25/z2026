import { describe, it, expect } from "vitest";
import { DAY_MS, computeAccess } from "../../app/lib/billing/period.js";
import { reminderKind, reminderMessage } from "../../app/lib/billing/reminders.js";

const NOW = new Date("2026-11-15T09:00:00Z");
const access = (createdDaysAgo, extra = {}) => computeAccess({ now: NOW, createdAt: new Date(NOW.getTime() - createdDaysAgo * DAY_MS), launchedAt: new Date(0), graceDays: 3, trialDays: 30, ...extra });

describe("subscription reminders", () => {
  it("says nothing while more than five days are left", () => {
    expect(reminderKind(access(10), NOW)).toBeNull();
  });

  it("warns a paid period at five days and at the last day", () => {
    const paid = (daysLeft) => computeAccess({ now: NOW, createdAt: new Date(0), launchedAt: new Date(0), paidUntil: new Date(NOW.getTime() + daysLeft * DAY_MS) });
    expect(reminderKind(paid(6), NOW)).toBeNull();
    expect(reminderKind(paid(5), NOW)).toBe("ends_5d");
    expect(reminderKind(paid(0.5), NOW)).toBe("ends_1d");
  });

  it("warns the 7 free days on day five (two left) and on the last day, not before", () => {
    const free = (createdDaysAgo) => computeAccess({ now: NOW, createdAt: new Date(NOW.getTime() - createdDaysAgo * DAY_MS), launchedAt: new Date(0), graceDays: 3, trialDays: 7 });
    expect(reminderKind(free(2), NOW)).toBeNull();
    expect(reminderKind(free(5), NOW)).toBe("ends_5d");
    expect(reminderKind(free(6.5), NOW)).toBe("ends_1d");
  });

  it("tells the account when it ended, and once more when it closed (only that week)", () => {
    expect(reminderKind(access(31), NOW)).toBe("ended");
    expect(reminderKind(access(34), NOW)).toBe("closed");
    expect(reminderKind(access(45), NOW)).toBeNull();
  });

  it("words the free month and a paid period differently", () => {
    expect(reminderMessage("ends_5d", access(25)).title).toContain("دوره‌ی رایگان");
    const paid = computeAccess({ now: NOW, createdAt: new Date(0), launchedAt: new Date(0), paidUntil: new Date(NOW.getTime() + 3 * DAY_MS) });
    expect(reminderMessage("ends_5d", paid).title).toBe("اشتراکت داره تموم می‌شه");
  });

  it("keeps SMS values free of spaces (Kavenegar tokens)", () => {
    for (const kind of ["ends_5d", "ends_1d", "ended", "closed"]) {
      const { sms } = reminderMessage(kind, access(kind === "closed" ? 34 : kind === "ended" ? 31 : 25), { graceDays: 3 });
      for (const value of Object.values(sms.values)) expect(String(value)).not.toMatch(/\s/);
    }
  });
});
