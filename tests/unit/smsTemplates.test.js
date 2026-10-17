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
