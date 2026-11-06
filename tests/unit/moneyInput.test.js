import { describe, expect, it } from "vitest";
import { groupTypedAmount, parseTomanAmount } from "../../app/shared/lib/money.js";

describe("groupTypedAmount (a mark after every three digits while typing)", () => {
  it("groups a plain number and shows Persian digits", () => {
    expect(groupTypedAmount("450000")).toBe("۴۵۰٬۰۰۰");
    expect(groupTypedAmount("1200000")).toBe("۱٬۲۰۰٬۰۰۰");
    expect(groupTypedAmount("999")).toBe("۹۹۹");
  });

  it("takes Persian and Arabic digits and old separators, and re-groups them", () => {
    expect(groupTypedAmount("۴۵۰٬۰۰۰۰")).toBe("۴٬۵۰۰٬۰۰۰");
    expect(groupTypedAmount("1,250,000")).toBe("۱٬۲۵۰٬۰۰۰");
    expect(groupTypedAmount("٣٥٠٠٠٠")).toBe("۳۵۰٬۰۰۰");
  });

  it("keeps free text exactly as typed", () => {
    expect(groupTypedAmount("از ۶۵۰ هزار")).toBe("از ۶۵۰ هزار");
    expect(groupTypedAmount("از ۲.۴ م")).toBe("از ۲.۴ م");
    expect(groupTypedAmount("رایگان")).toBe("رایگان");
  });

  it("handles empty, separators only and leading zeros", () => {
    expect(groupTypedAmount("")).toBe("");
    expect(groupTypedAmount(null)).toBe("");
    expect(groupTypedAmount("٬")).toBe("");
    expect(groupTypedAmount("0005")).toBe("۵");
  });

  it("reads back to the same whole number", () => {
    for (const n of [0, 5, 999, 1000, 450000, 12345678]) {
      expect(parseTomanAmount(groupTypedAmount(String(n)))).toBe(n);
    }
  });
});
