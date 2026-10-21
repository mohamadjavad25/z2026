import { NextResponse } from "next/server";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import { withErrorHandling } from "../../lib/http.js";

export const runtime = "nodejs";

// A page, never the whole table -- see the matching note in app/api/salons/route.js.
const DEFAULT_PAGE = 100;

async function _GET(request) {
  await ensureDb();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const requested = Number(searchParams.get("limit")) || 0;
  const { artists: list, nextCursor } = await artists.listArtists({
    cursor,
    limit: requested || DEFAULT_PAGE,
    maxLimit: requested ? 50 : DEFAULT_PAGE
  });
  return NextResponse.json({ data: { artists: list, nextCursor } });
}

export const GET = withErrorHandling(_GET);
