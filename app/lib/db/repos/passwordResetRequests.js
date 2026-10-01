import { getDb, all, get, run } from "../connection.js";

/**
 * Manual account-recovery queue: no SMS/OTP provider is wired in yet (see
 * project notes — real SMS OTP is deliberately deferred to just before
 * public launch), so "forgot password" can't be self-service today. A
 * locked-out user instead files a request here; the founder/support reviews
 * pending rows directly (via the admin-token-protected API routes) and
 * resolves one by calling the user back and setting a new password.
 */
export async function createRequest(phone, note = "") {
  const db = await getDb();
  const result = await run(db, `
    INSERT INTO password_reset_requests (phone, note, status, created_at)
    VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)
    RETURNING id
  `, [String(phone), String(note || "").slice(0, 300)]);
  return { ok: true, id: Number(result.rows[0].id) };
}

export async function listPendingRequests() {
  const db = await getDb();
  return all(db, `
    SELECT id, phone, note, status, created_at, resolved_at
    FROM password_reset_requests
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `);
}

export async function getRequestById(id) {
  const db = await getDb();
  return get(db, `
    SELECT id, phone, note, status, created_at, resolved_at
    FROM password_reset_requests
    WHERE id = $1
  `, [Number(id)]);
}

export async function markResolved(id) {
  const db = await getDb();
  await run(db, `
    UPDATE password_reset_requests
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [Number(id)]);
}
