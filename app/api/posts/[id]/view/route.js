import { NextResponse } from "next/server";
import { ensureDb } from "../../../../lib/db/connection.js";
import * as posts from "../../../../lib/db/repos/posts.js";
import { withErrorHandling } from "../../../../lib/http.js";

export const runtime = "nodejs";

async function _POST(_request, { params }) {
  await ensureDb();
  const { id } = await params;
  const post = await posts.incrementPostViews(Number(id));
  if (!post) return NextResponse.json({ error: "یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { post } });
}

export const POST = withErrorHandling(_POST);
