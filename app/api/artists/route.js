import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../lib/auth.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import { withErrorHandling } from "../../lib/http.js";

export const runtime = "nodejs";

async function _GET(request) {
  await ensureDb();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  // Paginate only when the caller opts in -- see the matching note in
  // app/api/salons/route.js for why omitting both preserves today's
  // "one call, the whole directory" behavior.
  if (!cursor && !limitParam) {
    return NextResponse.json({ data: { artists: await artists.listArtists() } });
  }
  const { artists: list, nextCursor } = await artists.listArtists({ cursor, limit: Number(limitParam) || 20 });
  return NextResponse.json({ data: { artists: list, nextCursor } });
}

export const GET = withErrorHandling(_GET);
