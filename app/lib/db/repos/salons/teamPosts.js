import { all, get, getDb, run, withTransaction } from "../../connection.js";

// Posts one artist may have waiting for one salon's answer at a time (owner's decision 2026-10-26).
export const TEAM_POST_PENDING_LIMIT = 10;

/**
 * Team posts on a salon's page need the salon's yes (owner's decision 2026-10-26, migration 056). A row says where a
 * post stands with one salon: "pending" (sent, waiting), "approved" (on the salon's page) or "declined" (the salon said
 * no, or took it off later; it cannot be sent again). Rows hang on the membership: leaving the team takes them away.
 * Every read joins the current membership, so a post only counts while its owner is still on that team.
 */

function mediaUrl(row) {
  return row.has_image ? `/api/media/post/${row.post_id}?v=${row.updated_at ? new Date(row.updated_at).getTime() : 0}` : "";
}

/** The salons an artist may send posts to (teams they are on) and, per post of theirs, where it stands with each. */
export async function listArtistTeamPosts(artistUserId, runner = null) {
  const db = runner || (await getDb());
  const [teams, rows] = await Promise.all([
    all(db, `
      SELECT st.salon_user_id, COALESCE(NULLIF(s.name, ''), su.name) AS salon_name
      FROM salon_staff st
      JOIN users su ON su.id = st.salon_user_id AND su.suspended_at IS NULL
      LEFT JOIN salons s ON s.user_id = st.salon_user_id
      WHERE st.artist_user_id = $1 AND NOT st.is_owner
      ORDER BY st.id
    `, [artistUserId]),
    all(db, `
      SELECT tp.post_id, tp.salon_user_id, tp.status
      FROM salon_team_posts tp
      JOIN salon_staff st ON st.id = tp.staff_id AND st.artist_user_id = $1
      JOIN posts p ON p.id = tp.post_id AND p.owner_user_id = $1
    `, [artistUserId])
  ]);
  const statuses = {};
  for (const row of rows) {
    statuses[row.post_id] = { ...(statuses[row.post_id] || {}), [row.salon_user_id]: row.status };
  }
  return {
    teams: teams.map((row) => ({ salonId: Number(row.salon_user_id), name: row.salon_name || "سالن" })),
    statuses
  };
}

/**
 * The artist sends one of their public posts to a salon whose team they are on. → { ok, status } or
 * { ok: false, code } (NOT_FOUND, PRIVATE, NOT_MEMBER, DECLINED, LIMIT). Sending again while it waits or is on the
 * page changes nothing.
 */
export async function sendTeamPost(artistUserId, postId, salonUserId) {
  return withTransaction(null, async (db) => {
    const post = await get(db, "SELECT id, is_public FROM posts WHERE id = $1 AND owner_user_id = $2", [postId, artistUserId]);
    if (!post) return { ok: false, code: "NOT_FOUND" };
    if (!post.is_public) return { ok: false, code: "PRIVATE" };
    const staff = await get(db, `
      SELECT id FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 AND NOT is_owner ORDER BY id LIMIT 1 FOR UPDATE
    `, [salonUserId, artistUserId]);
    if (!staff) return { ok: false, code: "NOT_MEMBER" };
    const current = await get(db, "SELECT status, staff_id FROM salon_team_posts WHERE post_id = $1 AND salon_user_id = $2", [postId, salonUserId]);
    if (current && Number(current.staff_id) === Number(staff.id)) {
      if (current.status === "declined") return { ok: false, code: "DECLINED" };
      return { ok: true, status: current.status, fresh: false };
    }
    // The membership row is locked above, so two sends at once cannot both slip under the limit.
    const waiting = await get(db, "SELECT COUNT(*) AS c FROM salon_team_posts WHERE staff_id = $1 AND status = 'pending'", [staff.id]);
    if (Number(waiting?.c || 0) >= TEAM_POST_PENDING_LIMIT) return { ok: false, code: "LIMIT" };
    // A row left from an earlier membership (the artist left and came back) starts over.
    await run(db, `
      INSERT INTO salon_team_posts (post_id, salon_user_id, staff_id, status, sent_at, decided_at)
      VALUES ($1, $2, $3, 'pending', now(), NULL)
      ON CONFLICT (post_id, salon_user_id) DO UPDATE SET staff_id = EXCLUDED.staff_id, status = 'pending', sent_at = now(), decided_at = NULL
    `, [postId, salonUserId, staff.id]);
    return { ok: true, status: "pending", fresh: true };
  });
}

/** The artist takes a post back from a salon (waiting or on its page). A "declined" row stays, so it cannot be resent. */
export async function withdrawTeamPost(artistUserId, postId, salonUserId, runner = null) {
  const db = runner || (await getDb());
  const result = await run(db, `
    DELETE FROM salon_team_posts tp
    USING posts p
    WHERE tp.post_id = $1 AND tp.salon_user_id = $2 AND tp.status <> 'declined'
      AND p.id = tp.post_id AND p.owner_user_id = $3
  `, [postId, salonUserId, artistUserId]);
  return result.rowCount > 0;
}

/** What the salon sees in «درخواست‌های تیم» and «پست‌های تیم توی صفحه‌ت»: waiting and approved posts of current members. */
export async function listSalonTeamPosts(salonUserId, runner = null) {
  const db = runner || (await getDb());
  const rows = await all(db, `
    SELECT tp.post_id, tp.status, tp.sent_at, p.title, p.tag, p.updated_at,
      (p.image <> '' OR p.image_url IS NOT NULL) AS has_image,
      st.artist_user_id, COALESCE(NULLIF(st.name, ''), u.name) AS artist_name
    FROM salon_team_posts tp
    JOIN salon_staff st ON st.id = tp.staff_id AND st.salon_user_id = $1
    JOIN posts p ON p.id = tp.post_id AND p.owner_user_id = st.artist_user_id AND p.is_public
    JOIN users u ON u.id = st.artist_user_id AND u.suspended_at IS NULL
    WHERE tp.salon_user_id = $1 AND tp.status IN ('pending', 'approved')
    ORDER BY tp.sent_at DESC, tp.post_id DESC
  `, [salonUserId]);
  const shape = (row) => ({
    postId: Number(row.post_id),
    title: row.title || row.tag || "",
    image: mediaUrl(row),
    artistId: Number(row.artist_user_id),
    artistName: row.artist_name || "",
    sentAt: row.sent_at
  });
  return {
    requests: rows.filter((row) => row.status === "pending").map(shape),
    approved: rows.filter((row) => row.status === "approved").map(shape)
  };
}

/**
 * The salon answers: "approve" or "decline" a waiting post, or "remove" one already on its page (it then counts as
 * declined). Only posts of current members, in the right state. → { ok, status, artistUserId, title } or { ok: false }.
 */
export async function decideTeamPost(salonUserId, postId, action, runner = null) {
  const db = runner || (await getDb());
  const from = action === "remove" ? "approved" : "pending";
  const to = action === "approve" ? "approved" : "declined";
  const row = await get(db, `
    UPDATE salon_team_posts tp SET status = $4, decided_at = now()
    FROM salon_staff st, posts p
    WHERE tp.post_id = $1 AND tp.salon_user_id = $2 AND tp.status = $3
      AND st.id = tp.staff_id AND st.salon_user_id = $2
      AND p.id = tp.post_id AND p.owner_user_id = st.artist_user_id
    RETURNING st.artist_user_id, p.title, p.tag
  `, [postId, salonUserId, from, to]);
  if (!row) return { ok: false };
  return { ok: true, status: to, artistUserId: Number(row.artist_user_id), title: row.title || row.tag || "" };
}

/** A post's picture changed: wherever it was on a salon's page, it goes back for that salon to see again. */
export async function resendTeamPostAfterNewImage(postId, runner) {
  await run(runner, "UPDATE salon_team_posts SET status = 'pending', sent_at = now(), decided_at = NULL WHERE post_id = $1 AND status = 'approved'", [postId]);
}

/** The ids of posts a salon approved, grouped by the artist (for the salon's public page). */
export async function approvedTeamPostIds(salonUserId, runner) {
  const rows = await all(runner, `
    SELECT tp.post_id FROM salon_team_posts tp
    JOIN salon_staff st ON st.id = tp.staff_id AND st.salon_user_id = $1
    JOIN posts p ON p.id = tp.post_id AND p.owner_user_id = st.artist_user_id
    WHERE tp.salon_user_id = $1 AND tp.status = 'approved'
  `, [salonUserId]);
  return rows.map((row) => Number(row.post_id));
}
