import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as social from "../../../lib/db/repos/social.js";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const reviewId = Number(id);
  if (!reviewId) return NextResponse.json({ error: "شناسه نامعتبر." }, { status: 400 });
  const body = await request.json();
  const result = social.replyToReview({
    reviewId,
    targetUserId: auth.user.id,
    replyText: body.replyText
  });
  if (!result.ok) {
    const status = result.error === "دسترسی غیرمجاز." ? 403 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ data: { review: result.review } });
}
