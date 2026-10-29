import { NextResponse } from "next/server";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import { withErrorHandling } from "../../lib/http.js";
import { createShortCache } from "../../lib/shortCache.js";

export const runtime = "nodejs";

// A page, never the whole table -- see the matching note in app/api/salons/route.js.
const DEFAULT_PAGE = 100;
// Same for everyone and read at every app start: built at most once per 15 s, as in app/api/salons/route.js.
const pages = createShortCache({ ttlMs: Number(process.env.FRFRO_DIRECTORY_CACHE_MS ?? 15_000), max: 200 });

async function _GET(request) {
  await ensureDb();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const requested = Number(searchParams.get("limit")) || 0;
  const body = await pages.get(`${cursor || ""}|${requested}`, async () => {
    const { artists: list, nextCursor } = await artists.listArtists({
      cursor,
      limit: requested || DEFAULT_PAGE,
      maxLimit: requested ? 50 : DEFAULT_PAGE
    });
    return JSON.stringify({ data: { artists: list, nextCursor } });
  });
  return new NextResponse(body, { headers: { "Content-Type": "application/json" } });
}

export const GET = withErrorHandling(_GET);
