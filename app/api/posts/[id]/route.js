import { NextResponse, after } from "next/server";
import { error, notFound, parseId, readJson, requireUser, withErrorHandling } from "../../../lib/http.js";
import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as posts from "../../../lib/db/repos/posts.js";
import { POST_AUTHOR_TYPES, limitPostWrites, validatePostBody } from "../../../lib/postGuard.js";

export const runtime = "nodejs";

async function _GET(request, { params }) {
  await ensureDb();
  const id = parseId((await params).id);
  if (!id) return notFound();
  const viewer = await getUserFromRequest(request);
  const post = await posts.getVisiblePost(id, viewer?.id || null);
  if (!post) return notFound();
  return NextResponse.json({ data: { post } });
}

async function _PATCH(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!POST_AUTHOR_TYPES.includes(auth.user.type)) return error("دسترسی غیرمجاز.", 403);
  const id = parseId((await params).id);
  if (!id) return notFound();
  const limited = await limitPostWrites(auth.user.id);
  if (limited) return limited;
  const body = await readJson(request);
  if (!body) return error("درخواست نامعتبر است.", 400);
  const invalid = validatePostBody(body, { creating: false });
  if (invalid) return invalid;
  const post = await posts.updatePost(id, auth.user.id, body, null, { defer: (fn) => after(fn) });
  if (!post) return notFound();
  return NextResponse.json({ data: { post } });
}

async function _DELETE(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const limited = await limitPostWrites(auth.user.id);
  if (limited) return limited;
  const ok = await posts.deletePost(id, auth.user.id);
  if (!ok) return notFound();
  return NextResponse.json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
