import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as social from "../../lib/db/repos/social.js";
import { setSalonFollow } from "../../lib/db/repos/salons.js";
import { getUserLiteById } from "../../lib/db/repos/users.js";

export const runtime = "nodejs";

async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: { followingIds: await social.listFollowingIds(auth.user.id) } });
}

async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const targetUserId = Number(body.targetUserId || body.userId);
  if (!targetUserId) return NextResponse.json({ error: "کدوم حساب؟ انتخابش کن." }, { status: 400 });
  // Only salons and artists can be followed: a follow puts the follower in their customers list.
  const target = await getUserLiteById(targetUserId);
  if (!target || (target.type !== "salon" && target.type !== "artist")) {
    return NextResponse.json({ error: "این صفحه پیدا نشد." }, { status: 404 });
  }
  if (targetUserId === auth.user.id) {
    return NextResponse.json({ error: "نمی‌تونی به خودت وصل شی." }, { status: 400 });
  }
  // `follow: true|false` sets the state; without it the call toggles (what the in-app buttons use). A visitor who has
  // just signed up from a public page asks for `follow: true` so an account that already follows is never flipped off.
  const result = typeof body.follow === "boolean"
    ? await setSalonFollow(targetUserId, auth.user.id, body.follow)
    : await social.toggleFollow(auth.user.id, targetUserId);
  if (!result.ok && result.error === "self") {
    return NextResponse.json({ error: "نمی‌تونی به خودت وصل شی." }, { status: 400 });
  }
  return NextResponse.json({ data: result });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
