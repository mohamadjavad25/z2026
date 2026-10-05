import { error, json, withErrorHandling } from "../../../../lib/http.js";
import { hashPassword, isValidIranMobile, normalizeDigits, normalizePhone } from "../../../../lib/auth.js";
import { ensureDb, getDb, run } from "../../../../lib/db/connection.js";
import * as users from "../../../../lib/db/repos/users.js";
import { otpConfig, verifyOtp } from "../../../../lib/otp.js";

export const runtime = "nodejs";

/** POST { phone, code, newPassword } -> sets the new password if the SMS code is right, and signs the account out everywhere. */
async function _POST(request) {
  await ensureDb();
  if (!otpConfig().enabled) return error("بازیابی با پیامک هنوز فعال نشده است.", 503);
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone || "");
  const code = normalizeDigits(String(body.code || "")).trim();
  const newPassword = normalizeDigits(String(body.newPassword || ""));
  if (!isValidIranMobile(phone) || !/^\d{5}$/.test(code)) return error("کد ۵رقمی را درست وارد کن.", 400);
  if (newPassword.length < 8) return error("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.", 400);

  const result = await verifyOtp(phone, "reset", code);
  if (!result.ok) {
    if (result.code === "rate_limited") return error("تلاش زیاد بود. چند دقیقه بعد دوباره امتحان کن.", 429);
    if (result.code === "wrong") return error("کد اشتباه است.", 400);
    return error("کد منقضی شده؛ کد جدید بگیر.", 400);
  }
  const user = await users.getUserByPhone(phone);
  if (!user) return error("حسابی با این شماره پیدا نشد.", 404);
  await users.updateUser(user.id, { password_hash: hashPassword(newPassword) });
  await run(await getDb(), "DELETE FROM sessions WHERE user_id = $1", [user.id]);
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
