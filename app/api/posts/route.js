import { NextResponse, after } from "next/server";
import { error, readJson, requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as posts from "../../lib/db/repos/posts.js";
import { POST_AUTHOR_TYPES, limitPostWrites, validatePostBody } from "../../lib/postGuard.js";

export const runtime = "nodejs";

async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: { posts: await posts.listPostsByOwner(auth.user.id) } });
}

async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!POST_AUTHOR_TYPES.includes(auth.user.type)) return error("نمونه‌کار رو سالن‌ها و آرتیست‌ها می‌ذارن.", 403);
  const limited = await limitPostWrites(auth.user.id);
  if (limited) return limited;
  const body = await readJson(request);
  if (!body) return error("درخواست درست نرسید؛ دوباره بزن.", 400);
  const invalid = validatePostBody(body, { creating: true });
  if (invalid) return invalid;
  if (body.inPortfolio === false && (await posts.countServiceOnlyPosts(auth.user.id)) >= posts.MAX_SERVICE_ONLY_POSTS) {
    return error("عکس‌های خدمت‌هات زیاد شده؛ از خدمت‌ها چندتا رو بردار.", 409);
  }
  if ((await posts.countOwnerPosts(auth.user.id)) >= posts.MAX_POSTS_PER_ACCOUNT) {
    return error("نمونه‌کارهات به سقف رسیده؛ چندتا رو پاک کن تا جا باز شه.", 409);
  }
  const post = await posts.createPost(auth.user.id, body, null, { defer: (fn) => after(fn) });
  return NextResponse.json({ data: { post } }, { status: 201 });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
