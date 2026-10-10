import { describe, it, expect } from "vitest";
import { canonicalPhone, completePhone, looksLikePhoneInput } from "../../app/shared/lib/phone.js";

describe("phone search gating", () => {
  it("treats digit-only input as a phone being typed", () => {
    expect(looksLikePhoneInput("0")).toBe(true);
    expect(looksLikePhoneInput("۰۹۳۸")).toBe(true);
    expect(looksLikePhoneInput("+98 938")).toBe(true);
    expect(looksLikePhoneInput("سالن ۲")).toBe(false);
    expect(looksLikePhoneInput("-")).toBe(false);
  });

  it("only returns a phone once all 11 digits are typed", () => {
    expect(completePhone("0")).toBe("");
    expect(completePhone("0938615630")).toBe("");
    expect(completePhone("09386156305")).toBe("09386156305");
    expect(completePhone("۰۹۳۸۶۱۵۶۳۰۵")).toBe("09386156305");
    expect(completePhone("+98 938 615 6305")).toBe("09386156305");
    expect(completePhone("9386156305")).toBe("09386156305");
    expect(completePhone("093861563051")).toBe("");
  });

  it("keeps the server's canonical form unchanged", () => {
    expect(canonicalPhone("0938615630")).toBe("0938615630");
    expect(canonicalPhone("hello")).toBe("");
  });
});
