import { NextResponse } from "next/server";
import { requireUser } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as social from "../../lib/db/repos/social.js";

export const runtime = "nodejs";

export async function GET(request) {
  ensureDb();
  const { searchParams } = new URL(request.url);
  const targetUserId = Number(searchParams.get("targetUserId"));
  if (!targetUserId) return NextResponse.json({ error: "هدف لازم است." }, { status: 400 });
  return NextResponse.json({ data: { reviews: social.listReviews(targetUserId) } });
}

export async function POST(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const targetUserId = Number(body.targetUserId);
  if (!targetUserId) return NextResponse.json({ error: "هدف لازم است." }, { status: 400 });
  if (Number(auth.user.id) === targetUserId) {
    return NextResponse.json({ error: "نمی‌تونی به خودت امتیاز بدی." }, { status: 400 });
  }
  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "امتیاز باید بین ۱ تا ۵ باشد." }, { status: 400 });
  }
  const review = social.addReview({
    targetUserId,
    authorUserId: auth.user.id,
    authorName: auth.user.name || "کاربر",
    rating,
    text: body.text,
    service: body.service
  });
  const summary = social.getTargetRatingSummary(targetUserId);
  return NextResponse.json({
    data: {
      review: {
        id: review.id,
        author_user_id: review.author_user_id,
        name: review.author_name,
        rating: review.rating,
        text: review.text,
        service: review.service,
        created_at: review.created_at
      },
      ...summary
    }
  }, { status: 201 });
}
