import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as social from "../../lib/db/repos/social.js";

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
  if (!targetUserId) return NextResponse.json({ error: "هدف لازم است." }, { status: 400 });
  const result = await social.toggleFollow(auth.user.id, targetUserId);
  if (!result.ok && result.error === "self") {
    return NextResponse.json({ error: "نمی‌توانی خودت را دنبال کنی." }, { status: 400 });
  }
  return NextResponse.json({ data: result });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
