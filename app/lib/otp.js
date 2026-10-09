import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getDb, get, run } from "./db/connection.js";
import { checkRateLimit } from "./rateLimit.js";
import { sendVerificationSms, smsEnabled } from "./sms.js";

const CODE_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const PROOF_TTL_MS = 15 * 60 * 1000;
const RESEND_SECONDS = 60;

function secret() {
  return process.env.FRFRO_OTP_SECRET || process.env.CRON_SECRET || "frfro-dev-otp-secret";
}

/** Whether the app can send codes, and whether sign-up demands one (set FRFRO_OTP_REQUIRED=1 once SMS works). */
export function otpConfig() {
  const enabled = smsEnabled();
  return { enabled, required: enabled && process.env.FRFRO_OTP_REQUIRED === "1", resendSeconds: RESEND_SECONDS };
}

const hashCode = (phone, purpose, code) => createHmac("sha256", secret()).update(`${phone}|${purpose}|${code}`).digest("hex");

function sign(payload) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** A signed, short-lived "this phone proved it owns the number" token, handed back after a correct code. */
export function createOtpProof(phone, purpose, now = Date.now()) {
  const payload = `${phone}|${purpose}|${now + PROOF_TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifyOtpProof(proof, phone, purpose, now = Date.now()) {
  const [encoded, signature] = String(proof || "").split(".");
  if (!encoded || !signature) return false;
  const payload = Buffer.from(encoded, "base64url").toString();
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const [proofPhone, proofPurpose, expires] = payload.split("|");
  return proofPhone === phone && proofPurpose === purpose && Number(expires) > now;
}

/** Creates a fresh code for (phone, purpose) and texts it. Throttled per phone and globally. */
export async function sendOtp(phone, purpose) {
  const perPhone = await checkRateLimit(`otp-send:${phone}`, 3, 15 * 60 * 1000);
  if (!perPhone.ok) return { ok: false, code: "rate_limited", retryAfterMs: perPhone.retryAfterMs };
  const global = await checkRateLimit("otp-send-global", 200, 60 * 60 * 1000);
  if (!global.ok) return { ok: false, code: "rate_limited", retryAfterMs: global.retryAfterMs };

  const code = String(randomInt(10000, 100000));
  const db = await getDb();
  await run(db, "DELETE FROM otp_codes WHERE phone = $1 AND purpose = $2", [phone, purpose]);
  await run(db, `
    INSERT INTO otp_codes (phone, purpose, code_hash, expires_at)
    VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 minute'))
  `, [phone, purpose, hashCode(phone, purpose, code), CODE_TTL_MINUTES]);
  const sent = await sendVerificationSms(phone, code, purpose);
  return sent.ok ? { ok: true } : { ok: false, code: "send_failed" };
}

/** Checks a code. A wrong guess costs an attempt; after MAX_ATTEMPTS the code is dead. A right one is single-use. */
export async function verifyOtp(phone, purpose, code) {
  const limited = await checkRateLimit(`otp-verify:${phone}`, 12, 15 * 60 * 1000);
  if (!limited.ok) return { ok: false, code: "rate_limited" };
  const db = await getDb();
  const row = await get(db, `
    SELECT id, code_hash, attempts FROM otp_codes
    WHERE phone = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > NOW()
    ORDER BY id DESC LIMIT 1
  `, [phone, purpose]);
  if (!row || row.attempts >= MAX_ATTEMPTS) return { ok: false, code: "expired" };
  const given = Buffer.from(hashCode(phone, purpose, String(code || "").trim()));
  const expected = Buffer.from(row.code_hash);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    await run(db, "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
    return { ok: false, code: "wrong" };
  }
  await run(db, "UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1", [row.id]);
  return { ok: true };
}
