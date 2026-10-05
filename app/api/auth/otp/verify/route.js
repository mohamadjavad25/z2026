import { error, json, withErrorHandling } from "../../../../lib/http.js";
import { isValidIranMobile, normalizeDigits, normalizePhone } from "../../../../lib/auth.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { createOtpProof, otpConfig, verifyOtp } from "../../../../lib/otp.js";

export const runtime = "nodejs";

/** POST { phone, code } -> { proof }. The proof is what POST /api/auth/register accepts as "this number is verified". */
async function _POST(request) {
  await ensureDb();
  if (!otpConfig().enabled) return error("ارسال پیامک هنوز فعال نشده است.", 503);
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone || "");
  const code = normalizeDigits(String(body.code || "")).trim();
  if (!isValidIranMobile(phone) || !/^\d{5}$/.test(code)) return error("کد ۵رقمی را درست وارد کن.", 400);
  const result = await verifyOtp(phone, "register", code);
  if (!result.ok) {
    if (result.code === "rate_limited") return error("تلاش زیاد بود. چند دقیقه بعد دوباره امتحان کن.", 429);
    if (result.code === "wrong") return error("کد اشتباه است.", 400);
    return error("کد منقضی شده؛ کد جدید بگیر.", 400);
  }
  return json({ data: { proof: createOtpProof(phone, "register") } });
}

export const POST = withErrorHandling(_POST);
