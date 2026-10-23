import { NextResponse } from "next/server";
import {
  createSessionForUser,
  publicUser,
  setSessionCookie,
  verifyPassword,
  normalizePhone,
  normalizeDigits,
  DUMMY_PASSWORD_HASH
} from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as users from "../../../lib/db/repos/users.js";
import { checkIpRateLimit, checkRateLimit } from "../../../lib/rateLimit.js";
import { readJson, withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

// Per-phone brute-force throttle: nothing else here artificially slows a
// scripted attacker hammering one known phone number with a password list
// (scrypt alone is not a real defense at request-per-second scale). Keyed by
// the normalized phone under attack, not by caller identity (there is none
// pre-auth) -- same DB-backed limiter every other abuse-prone route in this
// codebase already uses (see /api/salon-bookings, /api/artist/bookings).
const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_IP_LIMIT = 30;

async function _POST(request) {
  await ensureDb();
  const body = (await readJson(request)) || {};
  const phone = normalizePhone(body.phone);
  const password = normalizeDigits(String(body.password || ""));

  // Per address as well: the per-phone limit alone let one caller lock any salon out of its own account
  // with ten wrong passwords, or walk a password list across many phones.
  const ipLimited = await checkIpRateLimit(request, "login", LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
  if (!ipLimited.ok) {
    return NextResponse.json(
      { error: "زیاد امتحان کردی؛ چند دقیقه صبر کن.", code: "rate_limited" },
      { status: 429 }
    );
  }
  if (phone) {
    const limited = await checkRateLimit(`login:${phone}`, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "زیاد امتحان کردی؛ چند دقیقه صبر کن.", code: "rate_limited" },
        { status: 429 }
      );
    }
  }

  const user = await users.getUserByPhone(phone);

  if (!user) {
    // Burn the same scryptSync cost a real "wrong password" check below
    // pays, against a fixed dummy hash -- otherwise this branch returns
    // instantly while a wrong-password attempt doesn't, a timing
    // side-channel that leaks whether a phone number is registered even
    // though the response bodies already differ (see DUMMY_PASSWORD_HASH's
    // doc comment in app/lib/auth.js for why the codes themselves stay
    // distinct on purpose).
    verifyPassword(password, DUMMY_PASSWORD_HASH);
    return NextResponse.json(
      { error: "با این شماره حسابی نداری؛ اول ثبت‌نام کن.", code: "not_found" },
      { status: 401 }
    );
  }

  if (!verifyPassword(password, user.password_hash)) {
    return NextResponse.json(
      { error: "رمز اشتباهه؛ دوباره بزن.", code: "bad_password" },
      { status: 401 }
    );
  }

  // Said only after the password is right, so it can't be used to probe which numbers are suspended.
  if (user.suspended_at) {
    return NextResponse.json({ error: "این حساب بسته شده؛ به پشتیبانی فرفرو پیام بده.", code: "suspended" }, { status: 403 });
  }

  const session = await createSessionForUser(user.id);
  const response = NextResponse.json({ data: { user: publicUser(user) } });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}

export const POST = withErrorHandling(_POST);
