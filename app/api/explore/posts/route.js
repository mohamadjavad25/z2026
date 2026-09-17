import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as posts from "../../../lib/db/repos/posts.js";

export const runtime = "nodejs";

export async function GET(request) {
  ensureDb();
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag") || "همه";
  const list = posts.listExplorePosts({ tag });
  const user = getUserFromRequest(request);
  const savedTitles = user ? posts.listSavedTitles(user.id) : [];
  const ratings = user ? posts.listUserRatings(user.id) : {};
  return NextResponse.json({ data: { posts: list, savedTitles, ratings } });
}
