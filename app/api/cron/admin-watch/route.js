import { NextResponse } from "next/server";
import { verifyCronSecret } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { flushAdminNews } from "../../../lib/adminNews.js";
import { watchServer } from "../../../lib/serverWatch.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by the server's cron every 5 minutes (deploy/server/frfro.cron, CRON_SECRET bearer like the other cron
 * routes): the server watch first (its busy count goes into the 22:00 summary), then the operator's waiting news.
 */
async function _POST(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  await ensureDb();
  const watch = await watchServer(new URL(request.url).origin);
  const news = await flushAdminNews(new Date(), { busyToday: watch.busyToday });
  return NextResponse.json({ data: { watch, news } });
}

export const POST = withErrorHandling(_POST);
