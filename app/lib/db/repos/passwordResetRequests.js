import { getDb } from "../connection.js";

/**
 * Manual account-recovery queue: no SMS/OTP provider is wired in yet (see
 * project notes — real SMS OTP is deliberately deferred to just before
 * public launch), so "forgot password" can't be self-service today. A
 * locked-out user instead files a request here; the founder/support reviews
 * pending rows directly (via the admin-token-protected API routes) and
 * resolves one by calling the user back and setting a new password.
 */
export function createRequest(phone, note = "") {
  const row = getDb().prepare(`
    INSERT INTO password_reset_requests (phone, note, status, created_at)
    VALUES (?, ?, 'pending', datetime('now'))
  `).run(String(phone), String(note || "").slice(0, 300));
  return { ok: true, id: Number(row.lastInsertRowid) };
}

export function listPendingRequests() {
  return getDb().prepare(`
    SELECT id, phone, note, status, created_at, resolved_at
    FROM password_reset_requests
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `).all();
}

export function getRequestById(id) {
  return getDb().prepare(`
    SELECT id, phone, note, status, created_at, resolved_at
    FROM password_reset_requests
    WHERE id = ?
  `).get(Number(id));
}

export function markResolved(id) {
  getDb().prepare(`
    UPDATE password_reset_requests
    SET status = 'resolved', resolved_at = datetime('now')
    WHERE id = ?
  `).run(Number(id));
}
