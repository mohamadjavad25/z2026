/** The teams an artist is in, and leaving one. */
import { getDb, all, get, run } from "../../connection.js";
import { defaultArtistHours } from "../artists/hours.js";

/**
 * The teams an artist currently belongs to (salon_staff rows linked to their
 * account), with the salon's identity and the agreed terms from the accepted
 * invite or proposal (whichever exists). Powers the artist's "تیم‌های من".
 */
export async function listArtistTeams(artistUserId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT
      st.id AS staff_id,
      st.salon_user_id,
      st.role,
      st.state,
      st.leave_until,
      st.direct_allowed,
      st.created_at,
      COALESCE(NULLIF(s.name, ''), su.name) AS salon_name,
      COALESCE(s.area, '') AS salon_area,
      COALESCE(s.rules, '') AS salon_rules,
      (su.avatar <> '' OR su.avatar_url IS NOT NULL) AS salon_avatar,
      (su.poster <> '' OR su.poster_url IS NOT NULL) AS salon_poster, su.poster_position AS salon_poster_position,
      COALESCE(i.days, c.days, '') AS days,
      COALESCE(i.from_time, c.from_time, '') AS from_time,
      COALESCE(i.to_time, c.to_time, '') AS to_time,
      COALESCE(i.share_percent, c.share_percent, '') AS share_percent,
      COALESCE(i.capacity, c.capacity, '') AS capacity
    FROM salon_staff st
    JOIN users su ON su.id = st.salon_user_id
    LEFT JOIN salons s ON s.user_id = st.salon_user_id
    LEFT JOIN salon_artist_invites i
      ON i.salon_user_id = st.salon_user_id AND i.artist_user_id = st.artist_user_id AND i.status = 'تایید شد'
    LEFT JOIN LATERAL (
      SELECT * FROM artist_collabs
      WHERE salon_user_id = st.salon_user_id AND artist_user_id = st.artist_user_id AND status = 'تایید شد'
      ORDER BY id DESC LIMIT 1
    ) c ON TRUE
    WHERE st.artist_user_id = $1
    ORDER BY st.id DESC
  `, [artistUserId]);
  const salonIds = rows.map((row) => row.salon_user_id);
  const staffIds = rows.map((row) => row.staff_id);
  const [mates, salonHours, ownHours, posts] = salonIds.length ? await Promise.all([
    all(db, `
      SELECT st.salon_user_id, st.name, st.artist_user_id, st.is_owner, u.avatar <> '' OR u.avatar_url IS NOT NULL AS has_avatar
      FROM salon_staff st LEFT JOIN users u ON u.id = st.artist_user_id
      WHERE st.salon_user_id = ANY($1::int[]) AND st.state <> 'غیرفعال' AND st.artist_user_id IS DISTINCT FROM $2
      ORDER BY st.id
    `, [salonIds, artistUserId]),
    all(db, "SELECT salon_user_id, day, open_time, close_time, active FROM salon_hours WHERE salon_user_id = ANY($1::int[])", [salonIds]),
    all(db, "SELECT day, open_time, close_time, active FROM artist_hours WHERE artist_user_id = $1", [artistUserId]),
    all(db, "SELECT staff_id, status, COUNT(*)::int AS n FROM salon_team_posts WHERE staff_id = ANY($1::int[]) GROUP BY staff_id, status", [staffIds])
  ]) : [[], [], [], []];
  if (salonIds.length && !ownHours.length) ownHours.push(...defaultArtistHours.map((h) => ({ day: h.day, open_time: h.open_time, close_time: h.close_time, active: h.active })));
  const hoursOf = (list) => list.map((h) => ({ day: h.day, open: h.open_time || "", close: h.close_time || "", active: Boolean(h.active) }));
  return rows.map((row) => ({
    leaveUntil: row.state === "مرخصی" ? row.leave_until || "" : "",
    directAllowed: row.direct_allowed !== false,
    // The others on this team (never their numbers): name, and their photo when they have a frfro page.
    teammates: mates
      .filter((m) => m.salon_user_id === row.salon_user_id)
      .map((m) => ({ name: m.name || "", avatar: m.has_avatar && m.artist_user_id ? `/api/media/avatar/${m.artist_user_id}` : "", isOwner: Boolean(m.is_owner) })),
    salonHours: hoursOf(salonHours.filter((h) => h.salon_user_id === row.salon_user_id)),
    ownHours: hoursOf(ownHours),
    posts: {
      pending: posts.find((p) => p.staff_id === row.staff_id && p.status === "pending")?.n || 0,
      approved: posts.find((p) => p.staff_id === row.staff_id && p.status === "approved")?.n || 0
    },
    staffId: row.staff_id,
    salonId: row.salon_user_id,
    salonName: row.salon_name || "سالن",
    salonArea: row.salon_area || "",
    salonRules: row.salon_rules || "",
    salonAvatar: row.salon_avatar ? `/api/media/avatar/${row.salon_user_id}` : "",
    salonPoster: row.salon_poster ? `/api/media/poster/${row.salon_user_id}` : "",
    salonPosterPosition: row.salon_poster_position || "",
    role: row.role || "",
    state: row.state || "فعال",
    since: row.created_at,
    days: row.days || "",
    from: row.from_time || "",
    to: row.to_time || "",
    share: row.share_percent || "",
    capacity: row.capacity || ""
  }));
}

/**
 * The artist leaves a salon's team on their own. Mirrors the salon removing a
 * member: the staff row goes, accepted collaborations end, and the accepted
 * invite is cancelled so the pair can reconnect later through any of the paths.
 */
export async function leaveSalonTeam(artistUserId, salonUserId) {
  const db = await getDb();
  const staff = await get(db, `
    SELECT id, name FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 LIMIT 1
  `, [salonUserId, artistUserId]);
  if (!staff) {
    return { ok: false, error: "تو توی تیم این سالن نیستی.", code: "NOT_MEMBER" };
  }
  await run(db, "DELETE FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2", [salonUserId, artistUserId]);
  await run(db, `
    UPDATE artist_collabs
    SET status = 'پایان یافت', updated_at = CURRENT_TIMESTAMP
    WHERE salon_user_id = $1 AND artist_user_id = $2 AND status IN ('تایید شد', 'آماده ارسال')
  `, [salonUserId, artistUserId]);
  await run(db, `
    UPDATE salon_artist_invites
    SET status = 'لغو شد', updated_at = CURRENT_TIMESTAMP
    WHERE salon_user_id = $1 AND artist_user_id = $2 AND status IN ('تایید شد', 'در انتظار تایید')
  `, [salonUserId, artistUserId]);
  return { ok: true };
}
