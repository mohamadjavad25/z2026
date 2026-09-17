import { NextResponse } from "next/server";
import {
  createSessionForUser,
  hashPassword,
  publicUser,
  setSessionCookie,
  normalizePhone,
  normalizeDigits
} from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as users from "../../../lib/db/repos/users.js";
import { ensureSalonHours } from "../../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function POST(request) {
  ensureDb();
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone || body.data?.phone || "");
    const password = normalizeDigits(String(body.password || body.data?.password || ""));
    const type = String(body.type || "client");
    const data = body.data || body;

    if (!phone || !password) {
      return NextResponse.json({ error: "شماره و رمز عبور لازم است." }, { status: 400 });
    }
    if (!["client", "artist", "salon", "shop"].includes(type)) {
      return NextResponse.json({ error: "نقش نامعتبر است." }, { status: 400 });
    }
    if (users.getUserByPhone(phone)) {
      return NextResponse.json({ error: "این شماره قبلاً ثبت شده است." }, { status: 409 });
    }

    const user = users.createUser({
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

    if (type === "salon") ensureSalonHours(user.id);

    const session = createSessionForUser(user.id);
    const safe = publicUser(user);
    const response = NextResponse.json({ data: { user: safe }, profile: safe });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ثبت‌نام انجام نشد." }, { status: 500 });
  }
}
