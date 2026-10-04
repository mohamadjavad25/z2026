import { NextResponse, after } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as posts from "../../../lib/db/repos/posts.js";
import { isImageDataUrlTooLarge, isImageDataUrlInvalidType } from "../../../lib/mediaLimits.js";

export const runtime = "nodejs";

async function _GET(_request, { params }) {
  await ensureDb();
  const { id } = await params;
  const post = await posts.getPostById(Number(id));
  if (!post) return NextResponse.json({ error: "یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { post } });
}

async function _PATCH(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json();
  if (isImageDataUrlTooLarge(body.image)) {
    return NextResponse.json({ error: "حجم عکس بیش از حد مجاز (۵ مگابایت) است." }, { status: 413 });
  }
  if (isImageDataUrlInvalidType(body.image)) {
    return NextResponse.json({ error: "فرمت عکس پشتیبانی نمی‌شود." }, { status: 400 });
  }
  const post = await posts.updatePost(Number(id), auth.user.id, body, null, { defer: (fn) => after(fn) });
  if (!post) return NextResponse.json({ error: "یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { post } });
}

async function _DELETE(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const ok = await posts.deletePost(Number(id), auth.user.id);
  if (!ok) return NextResponse.json({ error: "یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
