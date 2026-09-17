import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import * as posts from "../../../../lib/db/repos/posts.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  return NextResponse.json({ data: { comments: posts.listPostComments(Number(id)) } });
}
