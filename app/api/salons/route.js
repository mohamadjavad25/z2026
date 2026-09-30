import { NextResponse } from "next/server";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { withErrorHandling } from "../../lib/http.js";

export const runtime = "nodejs";

async function _GET(request) {
  await ensureDb();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  // Paginate only when the caller opts in with ?limit= (or ?cursor=) --
  // omitting both preserves the existing "one call, the whole directory"
  // behavior useSalonDirectory.js relies on today (no load-more UI yet).
  // listSalons({}) (no limit) already returns the full unbounded list.
  if (!cursor && !limitParam) {
    const list = await salons.listSalons();
    return NextResponse.json({ salons: list, data: { salons: list } });
  }
  const { salons: list, nextCursor } = await salons.listSalons({ cursor, limit: Number(limitParam) || 20 });
  return NextResponse.json({ salons: list, data: { salons: list, nextCursor } });
}

export const GET = withErrorHandling(_GET);
