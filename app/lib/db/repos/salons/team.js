import { all } from "../../connection.js";
import { approvedTeamPostIds } from "./teamPosts.js";

/**
 * The salon's team as anyone may see it on its public page (owner's decision 2026-10-26): who they are and, for an
 * artist with a frfro account, the posts of theirs the salon approved (salon_team_posts, migration 056; owner's
 * decision of the same day: nothing goes on a salon's page without the salon's yes). Nothing private (phones, terms)
 * is in it. The salon owner's own row has no posts here: the salon's posts are theirs. `staff` is listSalonStaff()'s
 * result, in the salon's order; `salonUserId` is whose page it is.
 */
export async function listPublicTeam(staff, salonUserId, runner) {
  const members = (staff || []).filter((member) => member && (member.artist_name || member.name));
  const memberIds = new Set(members
    .filter((member) => !member.is_owner && member.artist_user_id && member.has_artist_profile)
    .map((member) => Number(member.artist_user_id)));
  const approved = memberIds.size ? await approvedTeamPostIds(salonUserId, runner) : [];
  const rows = approved.length ? await all(runner, `
    SELECT p.id, p.owner_user_id, p.title, p.tag, p.updated_at, p.created_at,
      (p.image <> '' OR p.image_url IS NOT NULL) AS has_image
    FROM posts p
    JOIN users u ON u.id = p.owner_user_id AND u.suspended_at IS NULL
    WHERE p.id = ANY($1::int[]) AND p.owner_user_id = ANY($2::int[]) AND p.is_public
    ORDER BY p.created_at DESC, p.id DESC
  `, [approved, [...memberIds]]) : [];
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
