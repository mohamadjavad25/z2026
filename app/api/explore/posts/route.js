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
  const list = await posts.listExplorePosts({ tag });
  const user = await getUserFromRequest(request);
  const savedTitles = user ? await posts.listSavedTitles(user.id) : [];
  return NextResponse.json({ data: { posts: list, savedTitles } });
}

export const GET = withErrorHandling(_GET);
