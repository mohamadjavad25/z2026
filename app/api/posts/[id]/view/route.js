import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureDb } from "../../../../lib/db/connection.js";
import { getUserFromRequest } from "../../../../lib/auth.js";
import * as posts from "../../../../lib/db/repos/posts.js";
import { error, notFound, parseId, withErrorHandling } from "../../../../lib/http.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";

export const runtime = "nodejs";

/** A viewer is a signed-in user, or (for guests) a hash of ip + user agent -- never stored raw. */
function viewerKeyFor(request, user) {
  if (user) return `u:${user.id}`;
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const agent = request.headers.get("user-agent") || "";
  return `g:${createHash("sha1").update(`${ip}|${agent}`).digest("hex").slice(0, 24)}`;
}

async function _POST(request, { params }) {
  await ensureDb();
  const id = parseId((await params).id);
  if (!id) return notFound();
  const user = await getUserFromRequest(request);
  const viewerKey = viewerKeyFor(request, user);
  const limited = await checkRateLimit(`post-view:${viewerKey}`, 120, 60 * 1000);
  if (!limited.ok) return error("تعداد درخواست‌ها زیاد است.", 429);
  const post = await posts.recordPostView(id, viewerKey, user?.id || null);
  if (!post) return notFound();
  return NextResponse.json({ data: { post } });
}

export const POST = withErrorHandling(_POST);
