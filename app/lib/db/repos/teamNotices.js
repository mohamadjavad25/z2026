import { getDb, all, run } from "../connection.js";

/**
 * «همکاری تموم شد» cards (migrations/050_team_notices.sql): one row per removal from, or departure from, a salon team,
 * for the person on the other side. Shown inside the app until they tap «باشه».
 * kind: "removed" (a salon took this artist off its team) | "left" (an artist left this salon's team) | "gone" (the salon deleted its account).
 */
export const REASON_MAX = 120;

export function cleanReason(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, REASON_MAX);
}

export async function addTeamNotice(userId, { kind, fromUserId = null, fromName = "", reason = "" }) {
  if (!userId || (kind !== "removed" && kind !== "left" && kind !== "gone")) return;
  const db = await getDb();
  await run(db, `
    INSERT INTO team_notices (user_id, kind, from_user_id, from_name, reason)
    VALUES ($1, $2, $3, $4, $5)
  `, [Number(userId), kind, fromUserId ? Number(fromUserId) : null, String(fromName || "").slice(0, 120), cleanReason(reason)]);
}

/** The cards this person has not closed yet, oldest first, with the other side's phone for «تماس». */
export async function listUnseenTeamNotices(userId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT n.id, n.kind, n.from_user_id, n.from_name, n.reason, n.created_at, u.phone AS from_phone
    FROM team_notices n
    LEFT JOIN users u ON u.id = n.from_user_id
    WHERE n.user_id = $1 AND n.seen_at IS NULL
    ORDER BY n.created_at ASC
    LIMIT 10
  `, [Number(userId)]);
  return rows.map((row) => ({
    id: Number(row.id),
    kind: row.kind,
    fromName: row.from_name || "",
    fromPhone: row.from_phone || "",
    reason: row.reason || "",
    createdAt: row.created_at
  }));
}

export async function markTeamNoticesSeen(userId, ids) {
  const list = (Array.isArray(ids) ? ids : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 50);
  if (!list.length) return;
  const db = await getDb();
  await run(db, "UPDATE team_notices SET seen_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND id = ANY($2::int[]) AND seen_at IS NULL", [Number(userId), list]);
}
