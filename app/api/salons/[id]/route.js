import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { suspendedAccountIds } from "../../../lib/db/repos/users.js";
import { PAGE_UNAVAILABLE_MESSAGE } from "../../../lib/billing/access.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

async function _GET(request, context) {
  await ensureDb();
  const params = await context?.params;
  const userId = Number(params?.id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "این سالن رو پیدا نکردیم." }, { status: 400 });
  }
  // A suspended salon's page is not available to anyone (its owner cannot log in either).
  if ((await suspendedAccountIds([userId])).has(userId)) {
    return NextResponse.json({ error: PAGE_UNAVAILABLE_MESSAGE }, { status: 404 });
  }
  const viewer = await getUserFromRequest(request);
  const salon = await salons.getSalon(userId, viewer?.id || null, { withTeam: true });
  if (!salon) {
    return NextResponse.json({ error: "سالن پیدا نشد." }, { status: 404 });
  }
  // A salon switched to "خصوصی" in تنظیمات → پروفایل عمومی سالن is only
  // visible to its own owner, same rule GET /api/artists/[id] already
  // enforces for its equivalent toggle.
  if (!salon.isPublic && viewer?.id !== userId) {
    return NextResponse.json({ error: "سالن پیدا نشد." }, { status: 404 });
  }
  // The number is the owner's login phone: only a signed-in viewer gets it (the app's «تماس با سالن»); the public
  // web page never shows it, so an anonymous request does not get it either.
  if (!viewer) delete salon.phone;
  return NextResponse.json({ data: { salon } });
}

export const GET = withErrorHandling(_GET);
