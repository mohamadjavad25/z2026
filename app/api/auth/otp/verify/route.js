import { error, json, readJson, requireUser, withErrorHandling } from "../../../../lib/http.js";
import { isValidIranMobile, normalizeDigits, normalizePhone } from "../../../../lib/auth.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { createOtpProof, otpConfig, phoneChangePurpose, verifyOtp } from "../../../../lib/otp.js";
import { checkIpRateLimit } from "../../../../lib/rateLimit.js";
import { OTP_VERIFY_PER_IP_15MIN } from "../../../../lib/limits.js";

export const runtime = "nodejs";

/** POST { phone, code } -> { proof }. The proof is what POST /api/auth/register accepts as "this number is verified". */
async function _POST(request) {
  await ensureDb();
  if (!otpConfig().enabled) return error("پیامک هنوز راه نیفتاده؛ با رمز وارد شو.", 503);
  const body = (await readJson(request)) || {};
  const phone = normalizePhone(body.phone || "");
  const code = normalizeDigits(String(body.code || "")).trim();
  if (!isValidIranMobile(phone) || !/^\d{5}$/.test(code)) return error("کد ۵ رقمی رو درست بزن.", 400);
  // Guessing codes across many phones from one address (the per-phone limit is in verifyOtp).
  if (!(await checkIpRateLimit(request, "otp-verify", OTP_VERIFY_PER_IP_15MIN, 15 * 60 * 1000)).ok) return error("زیاد امتحان کردی؛ چند دقیقه دیگه دوباره بزن.", 429);
  let purpose = "register";
  if (body.purpose === "phone_change") {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    purpose = phoneChangePurpose(auth.user.id);
  }
  const result = await verifyOtp(phone, purpose, code);
  if (!result.ok) {
    if (result.code === "rate_limited") return error("زیاد امتحان کردی؛ چند دقیقه دیگه دوباره بزن.", 429);
    if (result.code === "wrong") return json({ error: "کد اشتباهه؛ دوباره بزن.", code: "wrong", attemptsLeft: result.attemptsLeft }, { status: 400 });
    return error("این کد دیگه کار نمی‌کنه؛ یه کد تازه بگیر.", 400);
  }
  return json({ data: { proof: createOtpProof(phone, purpose) } });
}

export const POST = withErrorHandling(_POST);
