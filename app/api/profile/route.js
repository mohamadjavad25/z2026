import { NextResponse } from "next/server";
import { hashPassword, publicUser, verifyPassword } from "../../lib/auth.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as users from "../../lib/db/repos/users.js";
import { requireUser } from "../../lib/http.js";

export const runtime = "nodejs";

export async function GET(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ profile: publicUser(auth.user), data: { user: publicUser(auth.user) } });
}

export async function POST(request) {
  ensureDb();
  try {
    const body = await request.json();

    // Legacy signup path without session → redirect clients to /api/auth/register
    // Keep PATCH-like profile update for logged-in users.
    const auth = requireUser(request);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "برای ثبت‌نام از /api/auth/register استفاده کن." },
        { status: 401 }
      );
    }

    const data = body.data || body;
    const patch = {
      name: data.name,
      phone: data.phone,
      area: data.area,
      service: data.service,
      email: data.email,
      avatar: data.avatar,
      poster: data.poster,
      bio: data.bio,
      experienceYears: data.experienceYears,
      managerName: data.managerName
    };

    if (data.password) {
      if (!data.currentPassword) {
        return NextResponse.json({ error: "برای تغییر رمز، رمز فعلی را وارد کن." }, { status: 400 });
      }
      if (!verifyPassword(data.currentPassword, auth.user.password_hash)) {
        return NextResponse.json({ error: "رمز فعلی نادرست است." }, { status: 400 });
      }
      patch.password_hash = hashPassword(data.password);
    }

    const user = users.updateUser(auth.user.id, patch);
    return NextResponse.json({ profile: publicUser(user), data: { user: publicUser(user) } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ذخیره پروفایل انجام نشد." }, { status: 500 });
  }
}

export async function DELETE(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  // Soft approach: delete user cascades via FK
  const { getDb } = await import("../../lib/db/connection.js");
  getDb().prepare("DELETE FROM users WHERE id = ?").run(auth.user.id);
  return NextResponse.json({ profile: null, data: { user: null } });
}
