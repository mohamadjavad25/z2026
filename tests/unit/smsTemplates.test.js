import { describe, it, expect, afterEach } from "vitest";
import { SMS_TEMPLATES, kavenegarSafe } from "../../app/lib/smsTemplates.js";
import { sendTemplateSms, templateConfigured } from "../../app/lib/sms.js";

const ENV = ["FRFRO_SMS_PROVIDER", "KAVENEGAR_TEMPLATE_BILLING_RECEIPT", "FARAZSMS_PATTERN_BILLING_RECEIPT"];

describe("pattern SMS for subscriptions", () => {
  afterEach(() => {
    for (const key of ENV) delete process.env[key];
  });

  it("keeps Kavenegar tokens free of spaces, except the long ones", () => {
    expect(kavenegarSafe({ token: "۲۴ آبان", token2: "", token10: "سالن رز آبی" })).toEqual({ token: "۲۴_آبان", token2: "-", token10: "سالن رز آبی" });
  });

  it("has words and values for every template", () => {
    const values = { receipt: "FR-1405-000001", amount: "۵۰۰٬۰۰۰", until: "۱۴۰۵/۰۹/۲۴", days: "۵", since: "۱۴۰۵/۰۹/۲۴", who: "سالن رز" };
    for (const template of Object.values(SMS_TEMPLATES)) {
      expect(template.preview(values)).toMatch(/^فرفرو/);
      expect(Object.keys(template.kavenegar(values)).length).toBeGreaterThan(0);
      expect(Object.keys(template.faraz(values)).length).toBeGreaterThan(0);
    }
  });

  it("the 2026-10-30 texts: a hand-entered booking and a deleted salon (Kavenegar tokens match docs/OPERATIONS.md)", () => {
    const made = SMS_TEMPLATES.booking_made_for_you;
    expect(made.env).toBe("BOOKING_MADE");
    expect(made.kavenegar({ who: "سالن رز", day: "فردا", time: "۱۴:۳۰" })).toEqual({ token: "۱۴:۳۰", token10: "فردا", token20: "سالن رز" });
    expect(made.preview({ who: "سالن رز", day: "فردا", time: "۱۴:۳۰" })).toBe("فرفرو: سالن رز برایت نوبت فردا ساعت ۱۴:۳۰ ثبت کرد. در فرفرو ببین.");
    const gone = SMS_TEMPLATES.team_salon_gone;
    expect(gone.env).toBe("TEAM_SALON_GONE");
    expect(gone.kavenegar({ who: "سالن رز" })).toEqual({ token10: "سالن رز" });
    expect(gone.preview({ who: "سالن رز" })).toContain("حسابش را حذف کرد");
  });

  it("is off until a provider and the template's own pattern are set", async () => {
    expect(templateConfigured("billing_receipt")).toBe(false);
    process.env.FRFRO_SMS_PROVIDER = "kavenegar";
    expect(templateConfigured("billing_receipt")).toBe(false);
    process.env.KAVENEGAR_TEMPLATE_BILLING_RECEIPT = "frfro-receipt";
    expect(templateConfigured("billing_receipt")).toBe(true);
    process.env.FRFRO_SMS_PROVIDER = "farazsms";
    expect(templateConfigured("billing_receipt")).toBe(false);
    process.env.FARAZSMS_PATTERN_BILLING_RECEIPT = "abc123";
    expect(templateConfigured("billing_receipt")).toBe(true);
  });

  it("sends nothing (and touches no database) while not configured", async () => {
    expect(await sendTemplateSms("09120000000", "billing_receipt", {})).toMatchObject({ ok: false, skipped: true });
    expect(await sendTemplateSms("09120000000", "no_such_template", {})).toMatchObject({ ok: false, skipped: true });
  });
});
