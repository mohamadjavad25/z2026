import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as social from "../../lib/db/repos/social.js";

export const runtime = "nodejs";

/**
 * GET /api/followers -- the signed-in salon or artist's followers (each one is a
 * contact: name + phone from their own account), newest first, plus how many
 * are still new. Anyone else gets an empty list, not an error, so the shell can
 * poll it without caring about the account type.
 */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id, type } = auth.user;
  if (type !== "salon" && type !== "artist") {
    return NextResponse.json({ data: { followers: [], unseen: 0 } });
  }
  const [followers, unseen] = await Promise.all([
    social.listFollowersForOwner(id),
    social.countUnseenFollowers(id)
  ]);
  return NextResponse.json({
    data: {
      unseen,
      followers: followers.map(({ hasAvatar, ...follower }) => ({
        ...follower,
        avatar: hasAvatar ? `/api/media/avatar/${follower.userId}` : ""
      }))
    }
  });
}

export const GET = withErrorHandling(_GET);
