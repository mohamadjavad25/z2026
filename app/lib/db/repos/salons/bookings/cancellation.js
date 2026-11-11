import { run } from "../../../connection.js";

/**
 * Writes who cancelled a booking ({ by: 'client' | 'provider' | 'gone' | 'admin', userId }) and, for a provider
 * cancelling a booking that was confirmed ('تایید شده'), adds one to that account's counter (users.provider_cancel_count,
 * shown in the admin accounts list: a count only, no automatic penalty). Call it only from the transaction that really
 * changed the status, on that transaction's connection.
 */
export async function recordCancellation(db, table, bookingId, statusBefore, { by, userId = null } = {}) {
  if (!["client", "provider", "gone", "admin"].includes(by)) return;
  await run(db, `UPDATE ${table} SET cancelled_by = $2 WHERE id = $1`, [Number(bookingId), by]);
  if ((by === "provider" || by === "gone") && statusBefore === "تایید شده" && userId) {
    await run(db, "UPDATE users SET provider_cancel_count = provider_cancel_count + 1 WHERE id = $1", [Number(userId)]);
  }
}
