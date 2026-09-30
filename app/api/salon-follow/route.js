import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const salonUserId = Number(body.salonUserId || body.salonId);
  if (!salonUserId) return NextResponse.json({ error: "سالن نامعتبر است." }, { status: 400 });
  const follow = body.follow !== false;
  const result = await salons.setSalonFollow(salonUserId, auth.user.id, follow);
  return NextResponse.json({ data: result, follow: result, ...result });
}

export const POST = withErrorHandling(_POST);
