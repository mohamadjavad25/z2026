import { describe, it, expect } from "vitest";
import { DAY_MS, computeAccess, daysUntil, nextPeriod, receiptNumber, refundQuote, trialEndsAt } from "../../app/lib/billing/period.js";

const NOW = new Date("2026-11-15T09:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY_MS);
const daysAhead = (n) => new Date(NOW.getTime() + n * DAY_MS);

describe("subscription periods", () => {
  it("gives a new account 14 days from sign-up, and an account older than billing 30 days from launch", () => {
    expect(trialEndsAt({ createdAt: daysAgo(5), launchedAt: daysAgo(100) }).getTime()).toBe(daysAhead(9).getTime());
    expect(trialEndsAt({ createdAt: daysAgo(400), launchedAt: daysAgo(10) }).getTime()).toBe(daysAhead(20).getTime());
    expect(trialEndsAt({ createdAt: daysAgo(400), launchedAt: null }).getTime()).toBe(daysAgo(386).getTime());
  });

  it("is in the free period, then grace, then expired", () => {
    const base = { now: NOW, launchedAt: daysAgo(200), graceDays: 3 };
    const trial = computeAccess({ ...base, createdAt: daysAgo(5) });
    expect(trial).toMatchObject({ state: "trial", open: true, daysLeft: 9 });

    const grace = computeAccess({ ...base, createdAt: daysAgo(15) });
    expect(grace).toMatchObject({ state: "grace", open: true, daysLeft: 0, graceDaysLeft: 2 });

    const expired = computeAccess({ ...base, createdAt: daysAgo(20) });
    expect(expired).toMatchObject({ state: "expired", open: false, daysLeft: 0, graceDaysLeft: 0 });
  });

  it("is active while a paid period runs, even inside the free month", () => {
    const paid = computeAccess({ now: NOW, createdAt: daysAgo(10), launchedAt: daysAgo(200), paidUntil: daysAhead(200) });
    expect(paid).toMatchObject({ state: "active", open: true, daysLeft: 200 });
    expect(paid.accessEndsAt).toBe(daysAhead(200).toISOString());
  });

  it("closes right away with zero grace days", () => {
    const access = computeAccess({ now: NOW, createdAt: daysAgo(31), launchedAt: daysAgo(200), graceDays: 0 });
    expect(access.state).toBe("expired");
  });

  it("puts a new period after the current access, or from now once it has ended", () => {
    const early = nextPeriod({ now: NOW, accessEndsAt: daysAhead(12), days: 180 });
    expect(early.start.getTime()).toBe(daysAhead(12).getTime());
    expect(early.end.getTime()).toBe(daysAhead(192).getTime());

    const late = nextPeriod({ now: NOW, accessEndsAt: daysAgo(2), days: 30 });
    expect(late.start.getTime()).toBe(NOW.getTime());
    expect(late.end.getTime()).toBe(daysAhead(30).getTime());
  });

  it("counts a started day as a day", () => {
    expect(daysUntil(new Date(NOW.getTime() + 3 * 3600_000), NOW)).toBe(1);
    expect(daysUntil(daysAhead(5), NOW)).toBe(5);
    expect(daysUntil(daysAgo(1), NOW)).toBe(0);
  });

  it("numbers receipts by Persian year and payment id", () => {
    expect(receiptNumber(42, new Date("2026-11-15T09:00:00Z"))).toBe("FR-1405-000042");
    expect(receiptNumber(1234567, new Date("2027-04-01T09:00:00Z"))).toBe("FR-1406-1234567");
  });

  describe("refund quote (terms, section 4)", () => {
    const paid = { amountRial: 25_000_000, days: 180 };
    it("gives everything back for a period that has not started", () => {
      expect(refundQuote({ ...paid, periodStart: new Date(NOW.getTime() + 10 * DAY_MS), periodEnd: new Date(NOW.getTime() + 190 * DAY_MS), now: NOW }))
        .toEqual({ days: 180, amountRial: 25_000_000 });
    });
    it("gives back the unused days at the plan's own daily price, a started day counted as used", () => {
      const quote = refundQuote({ ...paid, periodStart: daysAgo(2.5), periodEnd: new Date(daysAgo(2.5).getTime() + 180 * DAY_MS), now: NOW });
      expect(quote.days).toBe(177);
      expect(quote.amountRial).toBe(Math.round((25_000_000 * 177) / 180 / 10) * 10);
      expect(quote.amountRial % 10).toBe(0);
    });
    it("gives nothing back for a period that has ended", () => {
      expect(refundQuote({ ...paid, periodStart: daysAgo(200), periodEnd: daysAgo(20), now: NOW })).toEqual({ days: 0, amountRial: 0 });
    });
  });
});
