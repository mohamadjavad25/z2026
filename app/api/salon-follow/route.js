import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { getUserLiteById } from "../../lib/db/repos/users.js";

export const runtime = "nodejs";

async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const salonUserId = Number(body.salonUserId || body.salonId);
  if (!salonUserId) return NextResponse.json({ error: "این سالن رو پیدا نکردیم." }, { status: 400 });
  const target = await getUserLiteById(salonUserId);
  if (!target || target.type !== "salon") return NextResponse.json({ error: "سالن پیدا نشد." }, { status: 404 });
  if (salonUserId === auth.user.id) return NextResponse.json({ error: "نمی‌تونی به خودت وصل شی." }, { status: 400 });
  const follow = body.follow !== false;
  // Only clients connect (owner's decision 2026-10-25); the same rule as /api/follows.
  if (follow && auth.user.type !== "client") {
    return NextResponse.json({ error: "فقط مشتری‌ها وصل می‌شن؛ سالن و آرتیست با «دعوت به تیمم» و «پیشنهاد همکاری» با هم کار می‌کنن.", code: "clients_only" }, { status: 403 });
  }
  const result = await salons.setSalonFollow(salonUserId, auth.user.id, follow);
  return NextResponse.json({ data: result });
}

export const POST = withErrorHandling(_POST);
