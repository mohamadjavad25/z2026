import { describe, it, expect } from "vitest";
import { PLANS, getPlan, plansFor, rialToToman, isBilledRole, TRIAL_DAYS } from "../../app/lib/billing/plans.js";

describe("subscription plans", () => {
  it("charges exactly the owner's prices (toman)", () => {
    const toman = Object.fromEntries(PLANS.map((plan) => [plan.id, rialToToman(plan.amountRial)]));
    expect(toman).toEqual({
      salon_1m: 500_000,
      salon_6m: 2_500_000,
      salon_12m: 4_500_000,
      artist_1m: 300_000,
      artist_6m: 1_500_000,
      artist_12m: 2_700_000
    });
  });

  it("stores amounts in rial, as gateways charge", () => {
    expect(getPlan("salon_1m").amountRial).toBe(5_000_000);
    expect(getPlan("artist_12m").amountRial).toBe(27_000_000);
  });

  it("gives one month free on six months and three on a year, so the year is cheapest per month", () => {
    for (const role of ["salon", "artist"]) {
      const [one, six, year] = plansFor(role);
      expect([one.giftMonths, six.giftMonths, year.giftMonths]).toEqual([0, 1, 3]);
      expect(six.savingRial).toBe(one.amountRial);
      expect(year.savingRial).toBe(one.amountRial * 3);
      expect(one.monthlyRial).toBeGreaterThan(six.monthlyRial);
      expect(six.monthlyRial).toBeGreaterThan(year.monthlyRial);
    }
  });

  it("runs each period for a fixed number of days", () => {
    expect(plansFor("salon").map((plan) => plan.days)).toEqual([30, 180, 365]);
    expect(TRIAL_DAYS).toBe(30);
  });

  it("bills only salons and artists", () => {
    expect(isBilledRole("salon")).toBe(true);
    expect(isBilledRole("artist")).toBe(true);
    expect(isBilledRole("client")).toBe(false);
    expect(plansFor("client")).toEqual([]);
    expect(getPlan("nope")).toBeNull();
  });
});
