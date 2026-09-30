import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as posts from "../../../lib/db/repos/posts.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

async function _GET(request) {
  await ensureDb();
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag") || "همه";
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const user = await getUserFromRequest(request);
  const savedTitles = user ? await posts.listSavedTitles(user.id) : [];
  // Paginate only when the caller opts in -- see the matching note in
  // app/api/salons/route.js for why omitting both preserves today's
  // "one call, the whole feed" behavior.
  if (!cursor && !limitParam) {
    const list = await posts.listExplorePosts({ tag });
    return NextResponse.json({ data: { posts: list, savedTitles } });
  }
  const { posts: list, nextCursor } = await posts.listExplorePosts({ tag, cursor, limit: Number(limitParam) || 20 });
  return NextResponse.json({ data: { posts: list, savedTitles, nextCursor } });
}

export const GET = withErrorHandling(_GET);
