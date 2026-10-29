import { error, json, readJson, withErrorHandling } from "../../../../lib/http.js";
import { MIN_PASSWORD_LENGTH, hashPassword, isValidIranMobile, normalizeDigits, normalizePhone } from "../../../../lib/auth.js";
import { ensureDb, getDb, run } from "../../../../lib/db/connection.js";
import * as users from "../../../../lib/db/repos/users.js";
import { otpConfig, verifyOtp } from "../../../../lib/otp.js";
import { checkIpRateLimit } from "../../../../lib/rateLimit.js";
import { OTP_VERIFY_PER_IP_15MIN } from "../../../../lib/limits.js";

export const runtime = "nodejs";

/** POST { phone, code, newPassword } -> sets the new password if the SMS code is right, and signs the account out everywhere. */
async function _POST(request) {
  await ensureDb();
  if (!otpConfig().enabled) return error("بازیابی با پیامک هنوز راه نیفتاده.", 503);
  const body = (await readJson(request)) || {};
  const phone = normalizePhone(body.phone || "");
  const code = normalizeDigits(String(body.code || "")).trim();
  const newPassword = normalizeDigits(String(body.newPassword || ""));
  if (!isValidIranMobile(phone) || !/^\d{5}$/.test(code)) return error("کد ۵ رقمی رو درست بزن.", 400);
  if (newPassword.length < MIN_PASSWORD_LENGTH) return error("رمز تازه دست‌کم ۸ حرف باشه.", 400);

  // Guessing codes across many phones from one address (the per-phone limit is in verifyOtp).
  if (!(await checkIpRateLimit(request, "otp-verify", OTP_VERIFY_PER_IP_15MIN, 15 * 60 * 1000)).ok) return error("زیاد امتحان کردی؛ چند دقیقه دیگه دوباره بزن.", 429);
  const result = await verifyOtp(phone, "reset", code);
  if (!result.ok) {
    if (result.code === "rate_limited") return error("زیاد امتحان کردی؛ چند دقیقه دیگه دوباره بزن.", 429);
    if (result.code === "wrong") return error("کد اشتباهه؛ دوباره بزن.", 400);
    return error("این کد دیگه کار نمی‌کنه؛ یه کد تازه بگیر.", 400);
  }
  const user = await users.getUserByPhone(phone);
  if (!user) return error("با این شماره حسابی نداری.", 404);
  await users.updateUser(user.id, { password_hash: await hashPassword(newPassword) });
  // The code just proved this account owns the number.
  await users.markPhoneVerified(user.id);
  await run(await getDb(), "DELETE FROM sessions WHERE user_id = $1", [user.id]);
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
