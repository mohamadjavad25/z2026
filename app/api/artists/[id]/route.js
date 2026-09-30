import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as artists from "../../../lib/db/repos/artists.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

async function _GET(request, { params }) {
  await ensureDb();
  const { id } = await params;
  const viewer = await getUserFromRequest(request);
  const artistUserId = Number(id);
  const artist = await artists.getPublicArtist(artistUserId, viewer?.id || null);
  if (!artist) return NextResponse.json({ error: "آرتیست یافت نشد." }, { status: 404 });
  // An artist switched to "خصوصی" in تنظیمات → ویترین عمومی آرتیست is only
  // visible to its own owner, same rule GET /api/salons/[id] already
  // enforces for its equivalent toggle.
  if (!artist.isPublic && viewer?.id !== artistUserId) {
    return NextResponse.json({ error: "آرتیست یافت نشد." }, { status: 404 });
  }
  return NextResponse.json({ data: { artist } });
}

export const GET = withErrorHandling(_GET);
