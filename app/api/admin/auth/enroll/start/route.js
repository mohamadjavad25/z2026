import { NextResponse } from "next/server";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { adminEnrollStart, sameOrigin } from "../../../../../lib/adminAuth.js";
import { readJson, withErrorHandling } from "../../../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _POST(request) {
  await ensureDb();
  if (!sameOrigin(request)) return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  const result = await adminEnrollStart(request, (await readJson(request)) || {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ data: { secret: result.secret, uri: result.uri, qr: result.qr } }, { headers: { "Cache-Control": "no-store" } });
}

export const POST = withErrorHandling(_POST);
