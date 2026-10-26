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
import { clientErrorResponse, readJson, validateBody, withErrorHandling } from "../../../lib/http.js";
import { MAX_PASSWORD_LENGTH, registerFieldsSchema } from "../../../lib/validation/user.js";
import { otpConfig, verifyOtpProof } from "../../../lib/otp.js";
import { isImageDataUrlInvalidType, isImageDataUrlTooLarge } from "../../../lib/mediaLimits.js";
import { getSetting } from "../../../lib/db/repos/adminControl.js";
import { toPersianDigits } from "../../../shared/lib/digits.js";
import { hasUniqueName, NAME_TAKEN_MESSAGE } from "../../../lib/businessName.js";

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
    const body = (await readJson(request)) || {};
    const phone = normalizePhone(body.phone || body.data?.phone || "");
    const password = normalizeDigits(String(body.password || body.data?.password || ""));
    const type = String(body.type || "client");
    const data = body.data || body;

    if (!phone || !password) {
      return NextResponse.json({ error: "شماره و رمزت رو بزن." }, { status: 400 });
    }
    if (!isValidIranMobile(phone)) {
      return NextResponse.json({ error: "شماره تماس باید یک شماره موبایل معتبر ایران باشد (مثلا 09123456789)." }, { status: 400 });
    }

    // Phone verification: required whenever SMS is on (otpConfig); a proof that is sent must always be valid.
    const proof = String(body.otpProof || "");
    if ((otpConfig().required || proof) && !verifyOtpProof(proof, phone, "register")) {
      return NextResponse.json({ error: "اول کد پیامکی رو بزن تا شماره‌ت تأیید شه.", code: "otp_required" }, { status: 400 });
    }
    const phoneVerified = Boolean(proof);
    // Same rule the sign-up form and the SMS password reset already apply; checked here too so a direct API call
    // cannot set a one-letter password.
    if (password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ error: "رمزت خیلی بلنده؛ کوتاه‌ترش کن." }, { status: 400 });
    }
    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `رمز عبور باید حداقل ${toPersianDigits(MIN_PASSWORD_LENGTH)} کاراکتر باشد.` }, { status: 400 });
    }

    const limited = await checkRateLimit(`register:${phone}`, REGISTER_ATTEMPT_LIMIT, REGISTER_WINDOW_MS);
    const ipLimited = limited.ok ? await checkIpRateLimit(request, "register", REGISTER_IP_LIMIT, REGISTER_WINDOW_MS) : limited;
    if (!limited.ok || !ipLimited.ok) {
      return NextResponse.json(
        { error: "زیاد امتحان کردی؛ چند دقیقه دیگه دوباره بزن.", code: "rate_limited" },
        { status: 429 }
      );
    }
    const fields = validateBody(registerFieldsSchema, {
      name: data.name ?? "", area: data.area ?? "", service: data.service ?? "", email: data.email ?? ""
    });
    if (!fields.ok) return fields.response;
    if (!["client", "artist", "salon"].includes(type)) {
      return NextResponse.json({ error: "مشتری هستی، سالن یا آرتیست؟ یکی رو بزن." }, { status: 400 });
    }
    // The operator can pause new accounts per role from the admin panel (Settings). A failed read keeps sign-up open.
    const signups = await getSetting("signups").catch(() => null);
    if (signups && signups[type] === false) {
      return NextResponse.json(
        { error: signups.message || "ثبت‌نام فعلاً بسته‌ست؛ یه کم دیگه سر بزن.", code: "signups_closed" },
        { status: 403 }
      );
    }
    if (await users.getUserByPhone(phone)) {
      return NextResponse.json({ error: "این شماره حساب داره؛ با رمزت وارد شو.", code: "phone_taken" }, { status: 409 });
    }
    if (hasUniqueName(type) && (await users.isBusinessNameTaken(fields.data.name))) {
      return NextResponse.json({ error: NAME_TAKEN_MESSAGE, code: "name_taken" }, { status: 409 });
    }
    // Same server-side checks /api/profile already applies to an avatar update --
    // an unauthenticated signup shouldn't be the one upload path without them.
    if (isImageDataUrlTooLarge(data.avatar)) {
      return NextResponse.json({ error: "عکس بزرگ‌تر از ۵ مگابایته؛ یه عکس کوچیک‌تر بذار." }, { status: 413 });
    }
    if (isImageDataUrlInvalidType(data.avatar)) {
      return NextResponse.json({ error: "این نوع عکس رو نمی‌شناسیم؛ JPG یا PNG بذار." }, { status: 400 });
    }

    const newAccount = {
      phone,
      passwordHash: hashPassword(password),
      type,
      name: fields.data.name,
      area: fields.data.area,
      service: fields.data.service,
      email: fields.data.email,
      avatar: typeof data.avatar === "string" ? data.avatar : ""
    };
    let user;
    if (hasUniqueName(type)) {
      // The name check and the insert happen under one lock (a second sign-up with the same name waits, then sees it).
      // The picture goes up after the lock is released: Storage is slow and must not hold other sign-ups.
      user = await users.withBusinessNameLock(async (client) => {
        if (await users.isBusinessNameTaken(newAccount.name, 0, client)) return null;
        return users.createUser({ ...newAccount, avatar: "" }, client);
      });
      if (!user) return NextResponse.json({ error: NAME_TAKEN_MESSAGE, code: "name_taken" }, { status: 409 });
      if (newAccount.avatar) user = (await users.updateUser(user.id, { avatar: newAccount.avatar })) || user;
    } else {
      user = await users.createUser(newAccount);
    }
    if (phoneVerified) await users.markPhoneVerified(user.id);

    if (type === "salon") await ensureSalonHours(user.id);

    const session = await createSessionForUser(user.id);
    const safe = publicUser(user);
    const response = NextResponse.json({ data: { user: safe } });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    // Two sign-ups for one number at the same moment: the database's unique key lets exactly one through.
    if (error?.code === "23505") return NextResponse.json({ error: "این شماره حساب داره؛ با رمزت وارد شو.", code: "phone_taken" }, { status: 409 });
    const badInput = clientErrorResponse(error);
    if (badInput) return badInput;
    console.error(error);
    return NextResponse.json({ error: "ثبت‌نام انجام نشد." }, { status: 500 });
  }
}

export const POST = withErrorHandling(_POST);
