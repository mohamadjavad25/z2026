import { error, json, withErrorHandling } from "../../../../lib/http.js";
import { isValidIranMobile, normalizePhone } from "../../../../lib/auth.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import * as users from "../../../../lib/db/repos/users.js";
import { otpConfig, sendOtp } from "../../../../lib/otp.js";

export const runtime = "nodejs";

/** POST { phone, purpose: "register" | "reset" } -> texts a 5-digit code. */
async function _POST(request) {
  await ensureDb();
  const config = otpConfig();
  if (!config.enabled) return error("ارسال پیامک هنوز فعال نشده است.", 503);
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone || "");
  const purpose = body.purpose === "reset" ? "reset" : body.purpose === "register" ? "register" : "";
  if (!purpose) return error("نوع درخواست نامعتبر است.", 400);
  if (!isValidIranMobile(phone)) return error("شماره موبایل معتبر وارد کن؛ مثلاً ۰۹۱۲۳۴۵۶۷۸۹.", 400);

  const existing = await users.getUserByPhone(phone);
  if (purpose === "register" && existing) return error("این شماره قبلاً ثبت شده است؛ وارد شو.", 409);
  if (purpose === "reset" && !existing) {
    // Same answer as a real send, so this can't be used to find out which numbers have accounts.
    return json({ data: { ok: true, resendSeconds: config.resendSeconds } });
  }

  const result = await sendOtp(phone, purpose);
  if (!result.ok) {
    if (result.code === "rate_limited") return error("درخواست کد زیاد بود. چند دقیقه بعد دوباره امتحان کن.", 429);
    return error("ارسال پیامک انجام نشد؛ کمی بعد دوباره امتحان کن.", 502);
  }
  return json({ data: { ok: true, resendSeconds: config.resendSeconds } });
}

export const POST = withErrorHandling(_POST);
