import { describe, it, expect } from "vitest";
import { createOtpProof, verifyOtpProof } from "../../app/lib/otp.js";

describe("otp proof token", () => {
  const now = 1_700_000_000_000;

  it("accepts a fresh proof for the same phone and purpose", () => {
    const proof = createOtpProof("09121234567", "register", now);
    expect(verifyOtpProof(proof, "09121234567", "register", now + 60_000)).toBe(true);
  });

  it("rejects another phone, another purpose, an expired or a tampered proof", () => {
    const proof = createOtpProof("09121234567", "register", now);
    expect(verifyOtpProof(proof, "09127654321", "register", now)).toBe(false);
    expect(verifyOtpProof(proof, "09121234567", "reset", now)).toBe(false);
    expect(verifyOtpProof(proof, "09121234567", "register", now + 16 * 60_000)).toBe(false);
    const [payload, signature] = proof.split(".");
    expect(verifyOtpProof(`${payload}.${signature.slice(0, -2)}xx`, "09121234567", "register", now)).toBe(false);
    expect(verifyOtpProof("", "09121234567", "register", now)).toBe(false);
    expect(verifyOtpProof("garbage", "09121234567", "register", now)).toBe(false);
  });
});
