import { NextResponse } from "next/server";
import {
  createSessionForUser,
  publicUser,
  setSessionCookie,
  verifyPassword,
  normalizePhone,
  normalizeDigits
} from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as users from "../../../lib/db/repos/users.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

// Per-phone brute-force throttle: nothing else here artificially slows a
// scripted attacker hammering one known phone number with a password list
// (scrypt alone is not a real defense at request-per-second scale). Keyed by
// the normalized phone under attack, not by caller identity (there is none
// pre-auth) -- same DB-backed limiter every other abuse-prone route in this
// codebase already uses (see /api/salon-bookings, /api/artist/bookings).
const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

async function _POST(request) {
  await ensureDb();
  const body = await request.json();
  const phone = normalizePhone(body.phone);
  const password = normalizeDigits(String(body.password || ""));

  if (phone) {
    const limited = await checkRateLimit(`login:${phone}`, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "تلاش‌های ورود زیاد بود. چند دقیقه صبر کن.", code: "rate_limited" },
        { status: 429 }
      );
    }
  }

  const user = await users.getUserByPhone(phone);

  if (!user) {
    return NextResponse.json(
      { error: "حسابی با این شماره پیدا نشد. اول ثبت‌نام کن.", code: "not_found" },
      { status: 401 }
    );
  }

  if (!verifyPassword(password, user.password_hash)) {
    return NextResponse.json(
      { error: "رمز عبور اشتباه است.", code: "bad_password" },
      { status: 401 }
    );
  }

  const session = await createSessionForUser(user.id);
  const response = NextResponse.json({ data: { user: publicUser(user) }, profile: publicUser(user) });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}

export const POST = withErrorHandling(_POST);
