import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import * as posts from "../../../../lib/db/repos/posts.js";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json();
  const post = posts.ratePost(auth.user.id, Number(id), body.rating, body.comment);
  if (!post) return NextResponse.json({ error: "یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { post } });
}
