import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import * as posts from "../../../../lib/db/repos/posts.js";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await posts.toggleSave(auth.user.id, Number(id));
  return NextResponse.json({ data: result });
}
