import { json, readObjectBody, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import { limitPostWrites } from "../../../lib/postGuard.js";
import { listArtistTeamPosts, sendTeamPost, withdrawTeamPost, TEAM_POST_PENDING_LIMIT } from "../../../lib/db/repos/salons/teamPosts.js";
import { sendPushToUser } from "../../../lib/push.js";
import * as users from "../../../lib/db/repos/users.js";
import { toPersianDigits } from "../../../shared/lib/digits.js";

export const runtime = "nodejs";

const REFUSALS = {
  NOT_FOUND: [404, "این پست رو پیدا نکردیم."],
  PRIVATE: [400, "پست «فقط من» رو نمی‌شه برای سالن فرستاد. اول بذارش برای همه."],
  NOT_MEMBER: [404, "تو دیگه توی تیم این سالن نیستی."],
  DECLINED: [409, "این سالن قبلاً این پست رو اضافه نکرد؛ دوباره نمی‌شه فرستادش."],
  LIMIT: [429, `${toPersianDigits(String(TEAM_POST_PENDING_LIMIT))} تا پستت منتظر تأیید این سالنه. وقتی جواب داد، بقیه رو بفرست.`]
};

/** GET /api/artist/team-posts -> { teams: [{ salonId, name }], statuses: { [postId]: { [salonId]: status } } } */
async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: await listArtistTeamPosts(auth.user.id) });
}

/**
 * POST /api/artist/team-posts  body: { postId, salonUserId, action: "send" | "withdraw" } -> sends one of the artist's
 * posts to a salon whose team they are on (it waits for the salon's yes), or takes it back. -> same shape as GET.
 */
async function _POST(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const limited = await limitPostWrites(auth.user.id);
  if (limited) return limited;
  const body = await readObjectBody(request);
  const postId = Number(body.postId || 0);
  const salonUserId = Number(body.salonUserId || 0);
  if (!postId || !salonUserId || !["send", "withdraw"].includes(body.action)) {
    return json({ error: "درخواست درست نرسید؛ دوباره بزن.", code: "INVALID" }, { status: 400 });
  }
  if (body.action === "withdraw") {
    await withdrawTeamPost(auth.user.id, postId, salonUserId);
    return json({ data: await listArtistTeamPosts(auth.user.id) });
  }
  const sent = await sendTeamPost(auth.user.id, postId, salonUserId);
  if (!sent.ok) {
    const [status, message] = REFUSALS[sent.code] || REFUSALS.NOT_FOUND;
    return json({ error: message, code: sent.code }, { status });
  }
  if (sent.fresh) {
    // A quiet push to the salon only, never an SMS (owner's decision 2026-10-26).
    const artist = await users.getUserLiteById(auth.user.id).catch(() => null);
    const name = String(artist?.name || "").trim() || "یکی از تیمت";
    void sendPushToUser(salonUserId, {
      title: "یه پست تازه از تیمت",
      body: `${name} یه پست فرستاده که توی صفحه‌ت بیاد. توی نمونه‌کارها ببینش.`,
      url: "/"
    }).catch(() => {});
  }
  return json({ data: await listArtistTeamPosts(auth.user.id) });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
