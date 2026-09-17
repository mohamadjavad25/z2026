import { getDb } from "../connection.js";

export function createSession(token, userId, expiresAt) {
  getDb().prepare(`
    INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)
  `).run(token, userId, String(expiresAt));
}

export function getValidSession(token) {
  const now = Date.now();
  const row = getDb().prepare(`
    SELECT * FROM sessions
    WHERE token = ? AND CAST(expires_at AS INTEGER) > ?
  `).get(token, now);
  return row || null;
}

export function deleteSession(token) {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function deleteUserSessions(userId) {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
