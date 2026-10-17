import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as social from "../../../lib/db/repos/social.js";

export const runtime = "nodejs";

/** POST /api/followers/seen -- the owner opened the customers page; new followers stop being "new". */
async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id, type } = auth.user;
  if (type !== "salon" && type !== "artist") return NextResponse.json({ data: { marked: 0 } });
  return NextResponse.json({ data: { marked: await social.markFollowersSeen(id) } });
}

export const POST = withErrorHandling(_POST);
