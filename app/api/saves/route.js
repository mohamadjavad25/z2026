import { NextResponse } from "next/server";
import { requireUser } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as social from "../../lib/db/repos/social.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";
import { getUserById } from "../../lib/db/repos/users.js";

export const runtime = "nodejs";

/**
 * GET /api/saves → the signed-in user's saved salons + saved artists, in
 * full card shape (see listSavedSalonsForUser/listSavedArtistsForUser) so
 * the "ذخیره‌شده‌ها" tab can render both lists without another round-trip —
 * same idea as GET /api/explore/posts folding listSavedTitles(userId) into
 * its response for saved posts, just as a dedicated endpoint here since
 * saves aren't tied to one listing route.
 * savedTargetIds is a flat id list for quick "is this open profile saved?"
 * checks, mirroring GET /api/follows' followingIds.
 */
export async function GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const savedSalons = await salons.listSavedSalonsForUser(auth.user.id);
  const savedArtists = await artists.listSavedArtistsForUser(auth.user.id);
  return NextResponse.json({
    data: {
      salons: savedSalons,
      artists: savedArtists,
      savedTargetIds: await social.listSavedProfileIds(auth.user.id)
    }
  });
}

/**
 * POST /api/saves { targetUserId } → toggle save on a salon or independent
 * artist's public profile. Mirrors POST /api/follows' auth/response shape;
 * target must be an existing salon/artist user (a client id is rejected,
 * same spirit as toggleFollow's self-save 400).
 */
export async function POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const targetUserId = Number(body.targetUserId || body.userId);
  if (!targetUserId) return NextResponse.json({ error: "هدف لازم است." }, { status: 400 });

  const target = await getUserById(targetUserId);
  if (!target || (target.type !== "salon" && target.type !== "artist")) {
    return NextResponse.json({ error: "این پروفایل قابل ذخیره نیست." }, { status: 400 });
  }

  const result = await social.toggleSaveProfile(auth.user.id, targetUserId);
  if (!result.ok && result.error === "self") {
    return NextResponse.json({ error: "نمی‌توانی پروفایل خودت را ذخیره کنی." }, { status: 400 });
  }
  return NextResponse.json({ data: result });
}
