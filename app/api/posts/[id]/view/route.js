import { NextResponse } from "next/server";
import { ensureDb } from "../../../../lib/db/connection.js";
import * as posts from "../../../../lib/db/repos/posts.js";

export const runtime = "nodejs";

export async function POST(_request, { params }) {
  ensureDb();
  const { id } = await params;
  const post = posts.incrementPostViews(Number(id));
  if (!post) return NextResponse.json({ error: "یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { post } });
}
