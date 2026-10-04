import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as posts from "../../../lib/db/repos/posts.js";

export const runtime = "nodejs";

/** The signed-in user's saved posts (independent of the explore feed). */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: { posts: await posts.listSavedPosts(auth.user.id) } });
}

export const GET = withErrorHandling(_GET);
