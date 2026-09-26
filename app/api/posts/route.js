import { NextResponse } from "next/server";
import { requireUser } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as posts from "../../lib/db/repos/posts.js";

export const runtime = "nodejs";

export async function GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: { posts: await posts.listPostsByOwner(auth.user.id) } });
}

export async function POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (!body.title) {
    return NextResponse.json({ error: "عنوان لازم است." }, { status: 400 });
  }
  const post = await posts.createPost(auth.user.id, body);
  return NextResponse.json({ data: { post } }, { status: 201 });
}
