import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as posts from "../../../lib/db/repos/posts.js";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  await ensureDb();
  const { id } = await params;
  const post = await posts.getPostById(Number(id));
  if (!post) return NextResponse.json({ error: "یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { post } });
}

export async function PATCH(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json();
  const post = await posts.updatePost(Number(id), auth.user.id, body);
  if (!post) return NextResponse.json({ error: "یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { post } });
}

export async function DELETE(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const ok = await posts.deletePost(Number(id), auth.user.id);
  if (!ok) return NextResponse.json({ error: "یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { ok: true } });
}
