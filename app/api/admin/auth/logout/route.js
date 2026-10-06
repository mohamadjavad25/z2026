import { NextResponse } from "next/server";
import { ensureDb } from "../../../../lib/db/connection.js";
import { clearAdminCookie, destroyAdminSession, sameOrigin } from "../../../../lib/adminAuth.js";
import { withErrorHandling } from "../../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _POST(request) {
  await ensureDb();
  if (!sameOrigin(request)) return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  await destroyAdminSession(request);
  const response = NextResponse.json({ data: { ok: true } }, { headers: { "Cache-Control": "no-store" } });
  clearAdminCookie(response);
  return response;
}

export const POST = withErrorHandling(_POST);
