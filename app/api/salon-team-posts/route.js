import { json, readObjectBody, requireUserRole, withErrorHandling } from "../../lib/http.js";
import { decideTeamPost, listSalonTeamPosts } from "../../lib/db/repos/salons/teamPosts.js";
import { sendPushToUser } from "../../lib/push.js";
import * as users from "../../lib/db/repos/users.js";

export const runtime = "nodejs";

/** GET /api/salon-team-posts -> { requests, approved }: team posts waiting for the salon's yes, and those on its page. */
async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: await listSalonTeamPosts(auth.user.id) });
}

/**
 * POST /api/salon-team-posts  body: { postId, action: "approve" | "decline" | "remove" } -> the salon adds a waiting
 * team post to its page, says no, or takes one off its page later. -> same shape as GET.
 */
async function _POST(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const postId = Number(body.postId || 0);
  if (!postId || !["approve", "decline", "remove"].includes(body.action)) {
    return json({ error: "درخواست درست نرسید؛ دوباره بزن.", code: "INVALID" }, { status: 400 });
  }
  const decided = await decideTeamPost(auth.user.id, postId, body.action);
  if (!decided.ok) {
    return json({ error: "این پست دیگه اینجا نیست؛ صفحه رو تازه کن.", code: "GONE", data: await listSalonTeamPosts(auth.user.id) }, { status: 409 });
  }
  if (body.action === "approve") {
    // The artist hears only the yes; a no or a later removal just changes the post's label (owner's decision 2026-10-26).
    const salon = await users.getUserLiteById(auth.user.id).catch(() => null);
    const name = String(salon?.name || "").trim() || "سالن";
    void sendPushToUser(decided.artistUserId, {
      title: `${name} پستت رو اضافه کرد`,
      body: decided.title ? `«${decided.title}» حالا توی صفحهٔ ${name} هم هست.` : `پستت حالا توی صفحهٔ ${name} هم هست.`,
      url: "/"
    }).catch(() => {});
  }
  return json({ data: await listSalonTeamPosts(auth.user.id) });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
