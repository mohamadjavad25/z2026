import { describe, it, expect } from "vitest";
import { normalizePhone } from "../../app/shared/lib/phone.js";

describe("normalizePhone (the one phone normaliser)", () => {
  it("turns Persian, Arabic-Indic and full-width digits into Latin and drops separators", () => {
    expect(normalizePhone("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(normalizePhone("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
    expect(normalizePhone("０９１２３４５６７８９")).toBe("09123456789");
    expect(normalizePhone(" 0912 345-67 89 ")).toBe("09123456789");
    expect(normalizePhone("(0912)345.6789")).toBe("09123456789");
  });
  it("is empty for nothing", () => {
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});
