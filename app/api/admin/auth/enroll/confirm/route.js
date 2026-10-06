import { NextResponse } from "next/server";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { adminEnrollConfirm, sameOrigin, setAdminCookie } from "../../../../../lib/adminAuth.js";
import { readJson, withErrorHandling } from "../../../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _POST(request) {
  await ensureDb();
  if (!sameOrigin(request)) return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  const result = await adminEnrollConfirm(request, (await readJson(request)) || {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  const response = NextResponse.json({ data: { ok: true } }, { headers: { "Cache-Control": "no-store" } });
  setAdminCookie(response, result.session.token, result.session.expiresAt);
  return response;
}

export const POST = withErrorHandling(_POST);
