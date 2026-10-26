import { all, run } from "../../connection.js";
import { getSettings } from "../userSettings.js";

// Newest public posts of each team artist shown on the salon's page.
const POSTS_PER_ARTIST = 24;

/**
 * The salon's team as anyone may see it on its public page (owner's decision 2026-10-26): who they are and, for an
 * artist with a frfro account who lets it (salon_staff.posts_on_salon, on by default; their public portfolio switch
 * also counts), their newest public posts. Nothing private (phones, terms) is in it. The salon owner's own row has
 * no posts here: the salon's posts are theirs. `staff` is listSalonStaff()'s result, in the salon's order.
 */
export async function listPublicTeam(staff, runner) {
  const members = (staff || []).filter((member) => member && (member.artist_name || member.name));
  const artistIds = [...new Set(members
    .filter((member) => !member.is_owner && member.artist_user_id && member.has_artist_profile && member.posts_on_salon !== false)
    .map((member) => Number(member.artist_user_id)))];
  const shown = (await Promise.all(artistIds.map(async (id) => ((await getSettings(id, runner)).publicPortfolio === false ? null : id))))
    .filter(Boolean);
  const rows = shown.length ? await all(runner, `
    SELECT id, owner_user_id, title, tag, updated_at, created_at, has_image FROM (
      SELECT p.id, p.owner_user_id, p.title, p.tag, p.updated_at, p.created_at,
        (p.image <> '' OR p.image_url IS NOT NULL) AS has_image,
        ROW_NUMBER() OVER (PARTITION BY p.owner_user_id ORDER BY p.featured DESC, p.created_at DESC, p.id DESC) AS n
      FROM posts p
      JOIN users u ON u.id = p.owner_user_id AND u.suspended_at IS NULL
      WHERE p.owner_user_id = ANY($1::int[]) AND p.is_public
    ) ranked
    WHERE n <= $2
    ORDER BY created_at DESC, id DESC
  `, [shown, POSTS_PER_ARTIST]) : [];
  const postsBy = new Map();
  for (const row of rows) {
    const list = postsBy.get(Number(row.owner_user_id)) || [];
    list.push({
      id: row.id,
      title: row.title || "",
      tag: row.tag || "",
      image: row.has_image ? `/api/media/post/${row.id}?v=${row.updated_at ? new Date(row.updated_at).getTime() : 0}` : "",
      ownerUserId: Number(row.owner_user_id),
      createdAt: row.created_at
    });
    postsBy.set(Number(row.owner_user_id), list);
  }
  return members.map((member) => {
    const artistId = member.artist_user_id ? Number(member.artist_user_id) : null;
    return {
      staffId: member.id ?? null,
      artistId: member.has_artist_profile ? artistId : null,
      name: member.artist_name || member.name,
      // The name bookings use for this member (salon_staff.name): what «رزرو با …» asks for.
      bookingName: String(member.name || "").trim(),
      role: String(member.role || member.artist_service || "").split(/[،,]/)[0].trim(),
      avatar: member.avatar || member.staff_avatar || "",
      isOwner: Boolean(member.is_owner),
      posts: artistId ? postsBy.get(artistId) || [] : []
    };
  });
}

/** The artist's «پست‌هام توی صفحهٔ این سالن هم بیاد» for one salon whose team they are on. → true when saved. */
export async function setTeamPostsOnSalon(artistUserId, salonUserId, on, runner) {
  const result = await run(runner, `
    UPDATE salon_staff SET posts_on_salon = $3, updated_at = CURRENT_TIMESTAMP
    WHERE salon_user_id = $1 AND artist_user_id = $2
  `, [Number(salonUserId), Number(artistUserId), Boolean(on)]);
  return result.rowCount > 0;
}
