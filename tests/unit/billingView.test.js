import { describe, it, expect } from "vitest";
import { accountView, bannerView, receiptText, teamMemberView } from "../../app/features/billing/billingView.js";

const iso = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
const overview = (account, extra = {}) => ({
  visible: true,
  enabled: true,
  checkoutReady: true,
  enforced: true,
  trialDays: 30,
  pending: null,
  lastPayment: null,
  account: { open: true, daysLeft: 0, graceDaysLeft: 0, accessEndsAt: iso(0), graceEndsAt: iso(3), ...account },
  ...extra
});

describe("subscription card and reminder bar", () => {
  it("shows nothing while billing is hidden", () => {
    expect(accountView({ visible: false })).toBeNull();
    expect(bannerView({ visible: false })).toBeNull();
  });

  it("describes the free month with a meter and a quiet button until the last days", () => {
    const view = accountView(overview({ state: "trial", daysLeft: 20, accessEndsAt: iso(20) }));
    expect(view.tone).toBe("trial");
    expect(view.title).toContain("۲۰ روز");
    expect(view.meter).toBeCloseTo(20 / 30);
    expect(view.action).toEqual({ label: "اشتراک بخر", emphasis: "secondary", disabled: false });
    expect(accountView(overview({ state: "trial", daysLeft: 4 })).action.emphasis).toBe("primary");
  });

  it("runs the active meter from the last payment to the end of access", () => {
    const paidAt = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const view = accountView(overview({ state: "active", daysLeft: 150, accessEndsAt: iso(150) }, { lastPayment: { title: "اشتراک شش‌ماهه سالن", days: 180, paidAt } }));
    expect(view.meter).toBeCloseTo(150 / 180, 2);
    expect(view.sub).toContain("اشتراک شش‌ماهه سالن");
  });

  it("warns in grace and alarms when closed", () => {
    expect(accountView(overview({ state: "grace", graceDaysLeft: 2 })).tone).toBe("warn");
    expect(accountView(overview({ state: "expired", open: false })).tone).toBe("danger");
  });

  it("stays calm when nobody can pay yet", () => {
    const view = accountView(overview({ state: "expired", open: false }, { enforced: false, checkoutReady: false }));
    expect(view.tone).toBe("soon");
    expect(view.action.disabled).toBe(true);
    expect(bannerView(overview({ state: "expired", open: false }, { enforced: false }))).toBeNull();
  });

  it("treats an artist on a salon's team like any other artist", () => {
    // Being on a team no longer exempts anyone: only a payment (theirs or the salon's) keeps them open.
    const artist = overview({ state: "expired", open: false }, { role: "artist" });
    expect(accountView(artist).tone).toBe("danger");
    expect(bannerView(artist).tone).toBe("danger");
  });

  it("describes each artist on the salon's team", () => {
    const enforced = { enforced: true };
    expect(teamMemberView({ account: { state: "trial", daysLeft: 12 } }, enforced)).toMatchObject({ tone: "trial", urgent: false });
    expect(teamMemberView({ account: { state: "active", daysLeft: 3, accessEndsAt: iso(3) } }, enforced)).toMatchObject({ tone: "active", urgent: true });
    expect(teamMemberView({ account: { state: "grace", graceDaysLeft: 2 } }, enforced).tone).toBe("warn");
    expect(teamMemberView({ account: { state: "expired" } }, enforced).tone).toBe("danger");
    expect(teamMemberView({ account: { state: "expired" } }, { enforced: false }).tone).toBe("soon");
  });

  it("raises the bar only when it matters", () => {
    expect(bannerView(overview({ state: "trial", daysLeft: 12 }))).toBeNull();
    expect(bannerView(overview({ state: "trial", daysLeft: 4 })).tone).toBe("info");
    expect(bannerView(overview({ state: "active", daysLeft: 1 })).tone).toBe("warn");
    expect(bannerView(overview({ state: "grace", graceDaysLeft: 2 })).tone).toBe("warn");
    expect(bannerView(overview({ state: "expired", open: false })).tone).toBe("danger");
    expect(bannerView(overview({ state: "active", daysLeft: 90 }, { pending: { id: 7 } }))).toMatchObject({ kind: "result", paymentId: 7 });
  });

  it("copies a readable receipt", () => {
    const text = receiptText({ receiptNo: "FR-1405-000042", title: "اشتراک شش‌ماهه سالن", amountToman: 2_500_000, refId: "123", paidAt: iso(0), periodEnd: iso(180) });
    expect(text).toContain("FR-1405-000042");
    expect(text).toContain("۲٬۵۰۰٬۰۰۰ تومان");
    expect(text).toContain("کد پیگیری بانک: ۱۲۳");
    expect(receiptText({ title: "اشتراک ماهانه آرتیست", amountToman: 300_000, paidFor: "نیلوفر" })).toContain("برای: نیلوفر");
  });
});
