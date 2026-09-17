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

export const runtime = "nodejs";

export async function POST(request) {
  ensureDb();
  const body = await request.json();
  const phone = normalizePhone(body.phone);
  const password = normalizeDigits(String(body.password || ""));
  const user = users.getUserByPhone(phone);

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

  const session = createSessionForUser(user.id);
  const response = NextResponse.json({ data: { user: publicUser(user) }, profile: publicUser(user) });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
