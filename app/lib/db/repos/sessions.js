import { getDb, all, get, run } from "../connection.js";

export async function createSession(token, userId, expiresAt) {
  const db = await getDb();
  await run(db, `
    INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)
  `, [token, userId, new Date(expiresAt).toISOString()]);
}

export async function getValidSession(token) {
  const db = await getDb();
  const row = await get(db, `
    SELECT * FROM sessions
    WHERE token = ? AND expires_at > NOW()
  `, [token]);
  return row || null;
}

export async function deleteSession(token) {
  const db = await getDb();
  await run(db, "DELETE FROM sessions WHERE token = ?", [token]);
}

export async function deleteUserSessions(userId) {
  const db = await getDb();
  await run(db, "DELETE FROM sessions WHERE user_id = ?", [userId]);
}
