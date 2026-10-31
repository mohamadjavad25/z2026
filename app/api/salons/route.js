import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { withErrorHandling } from "../../lib/http.js";
import { createShortCache } from "../../lib/shortCache.js";
import { buildSharedJson, sharedJsonResponse } from "../../lib/sharedJson.js";

export const runtime = "nodejs";

// No ?limit= still answers a whole page (not the whole table): this route is public, and with thousands of salons
// "everything in one answer" was 2 MB per call, which anyone could repeat without signing in. The answer carries
// nextCursor while more remain; the app's getSalons() follows it (app/shared/api/salons.js).
const DEFAULT_PAGE = 100;

// Every client downloads the whole directory when the app opens, and it is the same for everyone: each page is
// built and turned into JSON at most once per 15 s (load test of 2026-10-29: 76 ms of server time per call,
// the dearest request in the app). A new or edited salon shows up within those seconds.
const pages = createShortCache({ ttlMs: Number(process.env.FRFRO_DIRECTORY_CACHE_MS ?? 15_000), max: 200 });

async function _GET(request) {
  await ensureDb();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const requested = Number(searchParams.get("limit")) || 0;
  const body = await pages.get(`${cursor || ""}|${requested}`, async () => {
    const { salons: list, nextCursor } = await salons.listSalons({
      cursor,
      limit: requested || DEFAULT_PAGE,
      maxLimit: requested ? 50 : DEFAULT_PAGE
    });
    return buildSharedJson({ data: { salons: list, nextCursor } });
  });
  return sharedJsonResponse(request, body);
}

export const GET = withErrorHandling(_GET);
