import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import * as social from "../../../../lib/db/repos/social.js";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const reviewId = Number(id);
  if (!reviewId) return NextResponse.json({ error: "شناسه نامعتبر." }, { status: 400 });
  const result = social.toggleReviewLike(reviewId, auth.user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ data: { liked: result.liked, likeCount: result.likeCount } });
}
