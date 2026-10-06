import { describe, it, expect } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpCodeAt, totpStepAt, verifyTotp } from "../../app/lib/totp.js";

// RFC 6238 appendix B: secret "12345678901234567890" (SHA-1), 8-digit codes -> last 6 digits are what we use.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(totpCodeAt(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpCodeAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpCodeAt(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("round-trips base32", () => {
    const secret = generateTotpSecret();
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts the current and neighbouring step, rejects the rest and malformed input", () => {
    const now = 1_700_000_000_000;
    const step = totpStepAt(now);
    expect(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, step), { now })).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, step + 1), { now })).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, step + 2), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", { now })).toBeNull();
  });

  it("never accepts a step that was already used", () => {
    const now = 1_700_000_000_000;
    const step = totpStepAt(now);
    const code = totpCodeAt(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, { now, afterStep: step - 1 })).toBe(step);
    expect(verifyTotp(RFC_SECRET, code, { now, afterStep: step })).toBeNull();
  });
});
