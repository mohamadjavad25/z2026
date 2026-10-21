import { error, json, readJson, requireUser, withErrorHandling } from "../../../../lib/http.js";
import { isValidIranMobile, normalizePhone } from "../../../../lib/auth.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import * as users from "../../../../lib/db/repos/users.js";
import { otpConfig, phoneChangePurpose, sendOtp } from "../../../../lib/otp.js";
import { checkIpRateLimit, checkRateLimit } from "../../../../lib/rateLimit.js";
import { hasUniqueName, NAME_TAKEN_MESSAGE } from "../../../../lib/businessName.js";

export const runtime = "nodejs";

/**
 * POST { phone, purpose: "register" | "reset" | "phone_change" (needs a session), type?, name? } -> texts a 5-digit code. A sign-up sends its role and
 * name too, so a salon/artist name that is already taken is reported before an SMS is spent on it.
 */
async function _POST(request) {
  await ensureDb();
  const config = otpConfig();
  if (!config.enabled) return error("ارسال پیامک هنوز فعال نشده است.", 503);
  const body = (await readJson(request)) || {};
  const phone = normalizePhone(body.phone || "");
  const kind = body.purpose === "reset" ? "reset" : body.purpose === "register" ? "register" : body.purpose === "phone_change" ? "phone_change" : "";
  const purpose = kind;
  if (!purpose) return error("نوع درخواست نامعتبر است.", 400);
  if (!isValidIranMobile(phone)) return error("شماره موبایل معتبر وارد کن؛ مثلاً ۰۹۱۲۳۴۵۶۷۸۹.", 400);

  // One address may not burn through the hourly SMS budget everyone shares (otp.js), which would close
  // sign-up and password reset for every visitor.
  if (!(await checkIpRateLimit(request, "otp-send", 10, 60 * 60 * 1000)).ok) {
    return error("درخواست کد زیاد بود. کمی بعد دوباره امتحان کن.", 429);
  }

  // Changing the phone of a signed-in account: the code goes to the NEW number, and only to prove it is theirs.
  if (kind === "phone_change") {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    if (phone === auth.user.phone) return error("این همان شماره فعلی توست.", 400);
    // One account may not turn the SMS budget into a spam tool aimed at other people's numbers.
    if (!(await checkRateLimit(`otp-send-phone-change:${auth.user.id}`, 5, 60 * 60 * 1000)).ok) {
      return error("درخواست کد زیاد بود. کمی بعد دوباره امتحان کن.", 429);
    }
    if (await users.getUserByPhone(phone)) return error("این شماره برای حساب دیگری ثبت شده است.", 409);
    const sent = await sendOtp(phone, phoneChangePurpose(auth.user.id));
    if (!sent.ok) {
      if (sent.code === "rate_limited") return error("درخواست کد زیاد بود. چند دقیقه بعد دوباره امتحان کن.", 429);
      return error("ارسال پیامک انجام نشد؛ کمی بعد دوباره امتحان کن.", 502);
    }
    return json({ data: { ok: true, resendSeconds: config.resendSeconds } });
  }

  const existing = await users.getUserByPhone(phone);
  if (purpose === "register" && existing) return error("این شماره قبلاً ثبت شده است؛ وارد شو.", 409);
  if (purpose === "register" && hasUniqueName(body.type) && (await users.isBusinessNameTaken(body.name))) {
    return json({ error: NAME_TAKEN_MESSAGE, code: "name_taken" }, { status: 409 });
  }
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
