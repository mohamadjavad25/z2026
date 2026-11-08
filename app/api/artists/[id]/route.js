import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as artists from "../../../lib/db/repos/artists.js";
import { suspendedAccountIds } from "../../../lib/db/repos/users.js";
import { PAGE_UNAVAILABLE_MESSAGE } from "../../../lib/billing/access.js";
import { withErrorHandling } from "../../../lib/http.js";
import { canSeeLoginPhone } from "../../../lib/db/repos/contactVisibility.js";

export const runtime = "nodejs";

async function _GET(request, { params }) {
  await ensureDb();
  const { id } = await params;
  const artistUserId = Number(id);
  if (Number.isInteger(artistUserId) && (await suspendedAccountIds([artistUserId])).has(artistUserId)) {
    return NextResponse.json({ error: PAGE_UNAVAILABLE_MESSAGE }, { status: 404 });
  }
  const viewer = await getUserFromRequest(request);
  const artist = await artists.getPublicArtist(artistUserId, viewer?.id || null);
  if (!artist) return NextResponse.json({ error: "این آرتیست رو پیدا نکردیم." }, { status: 404 });
  // An artist switched to "خصوصی" in تنظیمات → ویترین عمومی آرتیست is only
  // visible to its own owner, same rule GET /api/salons/[id] already
  // enforces for its equivalent toggle.
  if (!artist.isPublic && viewer?.id !== artistUserId) {
    return NextResponse.json({ error: "این آرتیست رو پیدا نکردیم." }, { status: 404 });
  }
  // The number is the account's login phone (owner's decision of 2026-11-08): only the account itself, a connected
  // client, a client with a booking there, or the other side of a team gets it (the app's «تماس با آرتیست»). Anyone
  // else, signed in or not, sees the page without it.
  if (!(await canSeeLoginPhone(viewer?.id, artistUserId))) delete artist.phone;
  return NextResponse.json({ data: { artist } });
}

export const GET = withErrorHandling(_GET);
