import { describe, it, expect } from "vitest";
import { SMS_INCLUDED_PER_MONTH, SMS_LOW_AT, SMS_PACKS, getSmsPack, rialToToman } from "../../app/lib/billing/plans.js";
import { smsMonthKey } from "../../app/lib/billing/period.js";
import { checkoutSchema } from "../../app/lib/validation/billing.js";
import { SMS_PER_BUBBLE, smsView } from "../../app/features/billing/billingView.js";

/** SMS packs (owner's decisions of 2026-10-28): 200 a month inside the subscription, packs that never expire. */
describe("SMS packs", () => {
  it("sells two packs, priced in rial like the plans, with Persian titles", () => {
    expect(SMS_INCLUDED_PER_MONTH).toBe(200);
    expect(SMS_PACKS.map((pack) => [pack.id, pack.credits, rialToToman(pack.amountRial)])).toEqual([
      ["sms_100", 100, 40_000],
      ["sms_300", 300, 105_000]
    ]);
    expect(SMS_PACKS.map((pack) => pack.title)).toEqual(["بسته‌ی ۱۰۰ پیامک", "بسته‌ی ۳۰۰ پیامک"]);
    // The bigger pack is the cheaper SMS, and every SMS sells for more than it costs us (about 222 toman).
    const perSms = SMS_PACKS.map((pack) => pack.amountRial / 10 / pack.credits);
    expect(perSms[1]).toBeLessThan(perSms[0]);
    expect(Math.min(...perSms)).toBeGreaterThan(222 * 1.4);
  });

  it("finds a pack by id and nothing else", () => {
    expect(getSmsPack("sms_100")?.credits).toBe(100);
    expect(getSmsPack("sms_5")).toBeNull();
    expect(getSmsPack("salon_1m")).toBeNull();
  });
});

describe("the SMS month", () => {
  it("is the Persian month in Tehran, and turns over at Tehran midnight", () => {
    expect(smsMonthKey(new Date("2026-10-22T12:00:00Z"))).toBe("1405-07");
    expect(smsMonthKey(new Date("2026-10-22T20:29:00Z"))).toBe("1405-07");
    expect(smsMonthKey(new Date("2026-10-22T20:30:00Z"))).toBe("1405-08");
    expect(smsMonthKey(new Date("2026-10-28T09:00:00Z"))).toBe("1405-08");
  });
});

describe("checkout body", () => {
  it("takes a plan or a pack, never both, never none", () => {
    expect(checkoutSchema.safeParse({ plan: "salon_1m" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ pack: "sms_100" }).success).toBe(true);
    expect(checkoutSchema.safeParse({}).success).toBe(false);
    expect(checkoutSchema.safeParse({ plan: "salon_1m", pack: "sms_100" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ pack: "sms_999" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ plan: "artist_1m", forUserId: 5 }).success).toBe(true);
  });

  it("keeps a pack for the signed-in account's own wallet", () => {
    const result = checkoutSchema.safeParse({ pack: "sms_100", forUserId: 5 });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe("بسته‌ی پیامک فقط برای حساب خودته.");
  });
});

describe("the bubbles card", () => {
  const sms = (extra = {}) => ({ included: 200, includedLeft: 140, packCredits: 0, left: 140, usedThisMonth: 60, state: "ok", packs: [], ...extra });
  const overview = (smsPart, extra = {}) => ({ visible: true, enforced: true, checkoutReady: true, sandbox: false, sms: smsPart, ...extra });

  it("shows nothing while billing is not shown at all", () => {
    expect(smsView(null)).toBeNull();
    expect(smsView({ visible: false })).toBeNull();
    expect(smsView(overview(undefined))).toBeNull();
  });

  it("stays hidden until subscriptions are really on, because nothing is counted before that", () => {
    expect(smsView(overview(sms(), { enforced: false }))).toBeNull();
  });

  it("draws one bubble per ten SMS of the month's 200, filled for what is left", () => {
    expect(SMS_PER_BUBBLE).toBe(10);
    const view = smsView(overview(sms()));
    expect(view).toMatchObject({ state: "ok", left: 140, bubbleCount: 20, filled: 14, pose: "done" });
    expect(smsView(overview(sms({ includedLeft: 1, left: 1, state: "low" }))).filled).toBe(1);
    expect(smsView(overview(sms({ includedLeft: 0, left: 0, state: "empty" }))).filled).toBe(0);
    // Packs sit on top of the month and never fill more bubbles than the 20.
    expect(smsView(overview(sms({ includedLeft: 200, packCredits: 300, left: 500 }))).filled).toBe(20);
  });

  it("says what to do when it runs low or out, and keeps the answer to the client out of the warning", () => {
    expect(SMS_LOW_AT).toBe(40);
    const low = smsView(overview(sms({ includedLeft: 30, left: 30, state: "low" })));
    expect(low.sub).toContain("یادآوری نوبت");
    expect(low.action.emphasis).toBe("primary");
    const empty = smsView(overview(sms({ includedLeft: 0, left: 0, state: "empty" })));
    expect(empty.pose).toBe("lost");
    expect(empty.sub).toContain("تأیید و لغو نوبت همچنان می‌رسه");
  });

  it("tells the packs apart from the month's allowance", () => {
    const view = smsView(overview(sms({ includedLeft: 120, packCredits: 100, left: 220 })));
    expect(view.sub).toContain("۱۲۰");
    expect(view.sub).toContain("۱۰۰");
    expect(view.sub).toContain("تموم نمی‌شن");
  });

  it("closes the buy button until paying is open", () => {
    expect(smsView(overview(sms(), { checkoutReady: false })).action).toMatchObject({ disabled: true, label: "به‌زودی" });
    expect(smsView(overview(sms())).action).toMatchObject({ disabled: false, label: "بسته‌ی پیامک بخر" });
  });
});
