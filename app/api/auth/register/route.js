import { NextResponse } from "next/server";
import {
  createSessionForUser,
  hashPassword,
  publicUser,
  setSessionCookie,
  normalizePhone,
  normalizeDigits,
  isValidIranMobile,
  MIN_PASSWORD_LENGTH
} from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as users from "../../../lib/db/repos/users.js";
import { ensureSalonHours } from "../../../lib/db/repos/salons.js";
import { checkIpRateLimit, checkRateLimit } from "../../../lib/rateLimit.js";
import { withErrorHandling } from "../../../lib/http.js";
import { otpConfig, verifyOtpProof } from "../../../lib/otp.js";
import { isImageDataUrlInvalidType, isImageDataUrlTooLarge } from "../../../lib/mediaLimits.js";
import { getSetting } from "../../../lib/db/repos/adminControl.js";
import { toPersianDigits } from "../../../shared/lib/digits.js";

export const runtime = "nodejs";

// Per-phone throttle against scripted signup spam (account-creation flood /
// repeated-attempt scraping of the "already registered" check). Same
// DB-backed limiter this codebase already uses for other abuse-prone routes
// (see /api/auth/login, /api/salon-bookings). This does not throttle a
// distributed attacker rotating phone numbers -- that needs a trusted-proxy
// IP source this app's deployment doesn't define yet (see security report).
const REGISTER_ATTEMPT_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
// New accounts per address per hour (a salon signing up its whole team from one Wi-Fi stays well under it).
const REGISTER_IP_LIMIT = 20;

async function _POST(request) {
  await ensureDb();
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone || body.data?.phone || "");
    const password = normalizeDigits(String(body.password || body.data?.password || ""));
    const type = String(body.type || "client");
    const data = body.data || body;

    if (!phone || !password) {
      return NextResponse.json({ error: "شماره و رمز عبور لازم است." }, { status: 400 });
    }
    if (!isValidIranMobile(phone)) {
      return NextResponse.json({ error: "شماره تماس باید یک شماره موبایل معتبر ایران باشد (مثلا 09123456789)." }, { status: 400 });
    }

    // Phone verification: required once SMS is on and FRFRO_OTP_REQUIRED=1; a proof that is sent must always be valid.
    const proof = String(body.otpProof || "");
    if ((otpConfig().required || proof) && !verifyOtpProof(proof, phone, "register")) {
      return NextResponse.json({ error: "شمارهٔ موبایلت هنوز با کد پیامکی تأیید نشده است.", code: "otp_required" }, { status: 400 });
    }
    const phoneVerified = Boolean(proof);
    // Same rule the sign-up form and the SMS password reset already apply; checked here too so a direct API call
    // cannot set a one-letter password.
    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `رمز عبور باید حداقل ${toPersianDigits(MIN_PASSWORD_LENGTH)} کاراکتر باشد.` }, { status: 400 });
    }

    const limited = await checkRateLimit(`register:${phone}`, REGISTER_ATTEMPT_LIMIT, REGISTER_WINDOW_MS);
    const ipLimited = limited.ok ? await checkIpRateLimit(request, "register", REGISTER_IP_LIMIT, REGISTER_WINDOW_MS) : limited;
    if (!limited.ok || !ipLimited.ok) {
      return NextResponse.json(
        { error: "تلاش‌های ثبت‌نام زیاد بود. کمی بعد دوباره امتحان کن.", code: "rate_limited" },
        { status: 429 }
      );
    }
    if (!["client", "artist", "salon"].includes(type)) {
      return NextResponse.json({ error: "نقش نامعتبر است." }, { status: 400 });
    }
    // The operator can pause new accounts per role from the admin panel (Settings). A failed read keeps sign-up open.
    const signups = await getSetting("signups").catch(() => null);
    if (signups && signups[type] === false) {
      return NextResponse.json(
        { error: signups.message || "ثبت‌نام جدید فعلاً بسته است. کمی بعد دوباره سر بزن.", code: "signups_closed" },
        { status: 403 }
      );
    }
    if (await users.getUserByPhone(phone)) {
      return NextResponse.json({ error: "این شماره قبلاً ثبت شده است." }, { status: 409 });
    }
    // Same server-side checks /api/profile already applies to an avatar update --
    // an unauthenticated signup shouldn't be the one upload path without them.
    if (isImageDataUrlTooLarge(data.avatar)) {
      return NextResponse.json({ error: "حجم عکس بیش از حد مجاز (۵ مگابایت) است." }, { status: 413 });
    }
    if (isImageDataUrlInvalidType(data.avatar)) {
      return NextResponse.json({ error: "فرمت عکس پشتیبانی نمی‌شود." }, { status: 400 });
    }

    const user = await users.createUser({
      phone,
      passwordHash: hashPassword(password),
      type,
      name: data.name || "",
      area: data.area || "",
      service: data.service || "",
      email: data.email || "",
      avatar: data.avatar || ""
    });
    if (phoneVerified) await users.markPhoneVerified(user.id);

    if (type === "salon") await ensureSalonHours(user.id);

    const session = await createSessionForUser(user.id);
    const safe = publicUser(user);
    const response = NextResponse.json({ data: { user: safe } });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ثبت‌نام انجام نشد." }, { status: 500 });
  }
}

export const POST = withErrorHandling(_POST);
