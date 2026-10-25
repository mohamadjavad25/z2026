import { describe, it, expect } from "vitest";
import { createOtpProof, otpConfig, verifyOtpProof } from "../../app/lib/otp.js";

// createOtpProof/verifyOtpProof now fail closed with no real secret configured
// (see app/lib/otp.js) -- this file runs in the Vitest process itself, which
// doesn't inherit the spawned test server's env (see tests/globalSetup.js), so
// it needs its own.
process.env.FRFRO_OTP_SECRET ||= "test-otp-secret-for-unit-tests";

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

  it("fails closed with no real secret configured, instead of a guessable fallback", () => {
    const savedOtpSecret = process.env.FRFRO_OTP_SECRET;
    const savedCronSecret = process.env.CRON_SECRET;
    delete process.env.FRFRO_OTP_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect(createOtpProof("09121234567", "register", now)).toBe("");
      // Even a proof signed while a real secret *was* set must not verify once it's gone --
      // the point is "nobody can verify" here, not "nobody can create".
      process.env.FRFRO_OTP_SECRET = savedOtpSecret;
      const proof = createOtpProof("09121234567", "register", now);
      delete process.env.FRFRO_OTP_SECRET;
      expect(verifyOtpProof(proof, "09121234567", "register", now)).toBe(false);
    } finally {
      if (savedOtpSecret === undefined) delete process.env.FRFRO_OTP_SECRET; else process.env.FRFRO_OTP_SECRET = savedOtpSecret;
      if (savedCronSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedCronSecret;
    }
  });
});

describe("sign-up needs the SMS code whenever SMS works", () => {
  const saved = { provider: process.env.FRFRO_SMS_PROVIDER, required: process.env.FRFRO_OTP_REQUIRED };
  const restore = () => {
    for (const [key, value] of [["FRFRO_SMS_PROVIDER", saved.provider], ["FRFRO_OTP_REQUIRED", saved.required]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };

  it("is required as soon as a provider is set, with no second switch", () => {
    try {
      delete process.env.FRFRO_OTP_REQUIRED;
      process.env.FRFRO_SMS_PROVIDER = "kavenegar";
      expect(otpConfig()).toMatchObject({ enabled: true, required: true });
      process.env.FRFRO_OTP_REQUIRED = "1";
      expect(otpConfig().required).toBe(true);
      // Only a test setup turns it off, and only with an explicit 0.
      process.env.FRFRO_OTP_REQUIRED = "0";
      expect(otpConfig().required).toBe(false);
      delete process.env.FRFRO_SMS_PROVIDER;
      delete process.env.FRFRO_OTP_REQUIRED;
      expect(otpConfig()).toMatchObject({ enabled: false, required: false });
    } finally {
      restore();
    }
  });
});
