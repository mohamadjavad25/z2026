import { NextResponse } from "next/server";
import {
  createSessionForUser,
  hashPassword,
  publicUser,
  setSessionCookie,
  normalizePhone,
  normalizeDigits,
  isValidIranMobile
} from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as users from "../../../lib/db/repos/users.js";
import { ensureSalonHours } from "../../../lib/db/repos/salons.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

// Per-phone throttle against scripted signup spam (account-creation flood /
// repeated-attempt scraping of the "already registered" check). Same
// in-memory limiter this codebase already uses for other abuse-prone routes
// (see /api/auth/login, /api/salon-bookings). This does not throttle a
// distributed attacker rotating phone numbers -- that needs a trusted-proxy
// IP source this app's deployment doesn't define yet (see security report).
const REGISTER_ATTEMPT_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

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

    const limited = checkRateLimit(`register:${phone}`, REGISTER_ATTEMPT_LIMIT, REGISTER_WINDOW_MS);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "تلاش‌های ثبت‌نام زیاد بود. کمی بعد دوباره امتحان کن.", code: "rate_limited" },
        { status: 429 }
      );
    }
    if (!["client", "artist", "salon"].includes(type)) {
      return NextResponse.json({ error: "نقش نامعتبر است." }, { status: 400 });
    }
    if (await users.getUserByPhone(phone)) {
      return NextResponse.json({ error: "این شماره قبلاً ثبت شده است." }, { status: 409 });
    }

    const user = await users.createUser({
      phone,
      passwordHash: hashPassword(password),
      type,
      name: data.name || "",
      area: data.area || "",
      service: data.service || "",
      email: data.email || "",
      avatar: data.avatar || "",
      bio: data.bio || ""
    });

    if (type === "salon") await ensureSalonHours(user.id);

    const session = await createSessionForUser(user.id);
    const safe = publicUser(user);
    const response = NextResponse.json({ data: { user: safe }, profile: safe });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ثبت‌نام انجام نشد." }, { status: 500 });
  }
}

export const POST = withErrorHandling(_POST);
