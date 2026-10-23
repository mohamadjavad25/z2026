import { NextResponse } from "next/server";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { withErrorHandling } from "../../lib/http.js";

export const runtime = "nodejs";

// No ?limit= still answers a whole page (not the whole table): this route is public, and with thousands of salons
// "everything in one answer" was 2 MB per call, which anyone could repeat without signing in. The answer carries
// nextCursor while more remain; the app's getSalons() follows it (app/shared/api/salons.js).
const DEFAULT_PAGE = 100;

async function _GET(request) {
  await ensureDb();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const requested = Number(searchParams.get("limit")) || 0;
  const { salons: list, nextCursor } = await salons.listSalons({
    cursor,
    limit: requested || DEFAULT_PAGE,
    maxLimit: requested ? 50 : DEFAULT_PAGE
  });
  return NextResponse.json({ data: { salons: list, nextCursor } });
}

export const GET = withErrorHandling(_GET);
