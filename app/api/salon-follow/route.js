import { NextResponse } from "next/server";
import { requireUser } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function POST(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const salonUserId = Number(body.salonUserId || body.salonId);
  if (!salonUserId) return NextResponse.json({ error: "سالن نامعتبر است." }, { status: 400 });
  const follow = body.follow !== false;
  const result = salons.setSalonFollow(salonUserId, auth.user.id, follow);
  return NextResponse.json({ data: result, follow: result, ...result });
}
