import { getDb, get } from "../connection.js";

/**
 * A salon's team as the viewer may see it. The salon itself gets the list as it is; anyone else gets each member's
 * number only when canSeeLoginPhone allows that member, and never the private note the salon or an invite wrote.
 */
export async function teamListForViewer(staff, viewerUserId, salonUserId) {
  const list = Array.isArray(staff) ? staff : [];
  if (viewerUserId && Number(viewerUserId) === Number(salonUserId)) return list;
  return Promise.all(list.map(async (member) => {
    const { phone: _phone, artist_phone: _artistPhone, bio: _bio, artist_bio: _artistBio, ...shown } = member;
    const allowed = member.artist_user_id && await canSeeLoginPhone(viewerUserId, member.artist_user_id);
    return allowed ? { ...shown, phone: member.phone, artist_phone: member.artist_phone } : shown;
  }));
}

/**
 * Who may see a salon's or artist's login phone on their page (owner's decision of 2026-11-08, HEALTH debt 13).
 *
 * The number is the account's login and SMS number, so a stranger who only opened the page does not get it. It is
 * shown to the account itself, to a client who is connected to it («وصل شدن»), to a client with any booking there
 * (online or typed by the provider for that number, once the client proved the number with an SMS code — the same bar
 * the client's own booking list uses), and to the other side of a team (salon ↔ artist, any membership, past included).
 */
export async function canSeeLoginPhone(viewerUserId, providerUserId) {
  const viewer = Number(viewerUserId);
  const provider = Number(providerUserId);
  if (!viewer || !provider) return false;
  if (viewer === provider) return true;
  const db = await getDb();
  const row = await get(db, `
    WITH me AS (
      SELECT id, CASE WHEN phone_verified_at IS NOT NULL THEN frfro_phone_key(phone) ELSE '' END AS phone_key
      FROM users WHERE id = $1
    )
    SELECT (
      EXISTS (SELECT 1 FROM follows WHERE follower_user_id = $1 AND target_user_id = $2)
      OR EXISTS (
        SELECT 1 FROM salon_bookings b, me
        WHERE b.salon_user_id = $2
          AND (b.client_user_id = $1 OR (me.phone_key <> '' AND b.client_user_id IS NULL AND b.phone_normalized = me.phone_key))
      )
      OR EXISTS (
        SELECT 1 FROM artist_bookings b, me
        WHERE b.artist_user_id = $2
          AND (b.client_user_id = $1 OR (me.phone_key <> '' AND b.client_user_id IS NULL AND b.phone_normalized = me.phone_key))
      )
      OR EXISTS (
        SELECT 1 FROM salon_staff
        WHERE (salon_user_id = $2 AND artist_user_id = $1) OR (salon_user_id = $1 AND artist_user_id = $2)
      )
    ) AS allowed
  `, [viewer, provider]);
  return Boolean(row?.allowed);
}
