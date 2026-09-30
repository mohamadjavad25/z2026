import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

async function _GET(request, context) {
  await ensureDb();
  const params = await context?.params;
  const userId = Number(params?.id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
  }
  const viewer = await getUserFromRequest(request);
  const salon = await salons.getSalon(userId, viewer?.id || null);
  if (!salon) {
    return NextResponse.json({ error: "سالن پیدا نشد." }, { status: 404 });
  }
  // A salon switched to "خصوصی" in تنظیمات → پروفایل عمومی سالن is only
  // visible to its own owner, same rule GET /api/artists/[id] already
  // enforces for its equivalent toggle.
  if (!salon.isPublic && viewer?.id !== userId) {
    return NextResponse.json({ error: "سالن پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ salon });
}

export const GET = withErrorHandling(_GET);
