import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as posts from "../../lib/db/repos/posts.js";
import { isImageDataUrlTooLarge } from "../../lib/mediaLimits.js";

export const runtime = "nodejs";

async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: { posts: await posts.listPostsByOwner(auth.user.id) } });
}

async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (!body.title) {
    return NextResponse.json({ error: "عنوان لازم است." }, { status: 400 });
  }
  if (isImageDataUrlTooLarge(body.image)) {
    return NextResponse.json({ error: "حجم عکس بیش از حد مجاز (۵ مگابایت) است." }, { status: 413 });
  }
  const post = await posts.createPost(auth.user.id, body);
  return NextResponse.json({ data: { post } }, { status: 201 });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
