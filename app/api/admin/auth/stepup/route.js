import { NextResponse } from "next/server";
import { ensureDb } from "../../../../lib/db/connection.js";
import { adminStepUp, getAdminFromRequest, sameOrigin, GENERIC_FAILURE } from "../../../../lib/adminAuth.js";
import { readJson, withErrorHandling } from "../../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { password }: re-confirms the logged-in admin; unlocks dangerous actions for 5 minutes. */
async function _POST(request) {
  await ensureDb();
  if (!sameOrigin(request)) return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "ورود لازم است." }, { status: 401 });
  const body = (await readJson(request)) || {};
  const result = await adminStepUp(request, admin, body.password);
  if (!result.ok) return NextResponse.json({ error: result.status === 429 ? "تلاش زیاد بود. بعداً دوباره امتحان کن." : GENERIC_FAILURE }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ data: { ok: true } }, { headers: { "Cache-Control": "no-store" } });
}

export const POST = withErrorHandling(_POST);
