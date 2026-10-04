import { NextResponse } from "next/server";
import { notFound, parseId, readJson, requireUser, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import * as posts from "../../../../lib/db/repos/posts.js";

export const runtime = "nodejs";

/** Body `{ saved: true|false }` sets the state (idempotent); an empty body toggles. */
async function _POST(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const body = (await readJson(request)) || {};
  const desired = typeof body.saved === "boolean" ? body.saved : undefined;
  const result = await posts.setSave(auth.user.id, id, desired);
  if (!result) return notFound();
  return NextResponse.json({ data: result });
}

export const POST = withErrorHandling(_POST);
