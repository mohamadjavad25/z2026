import { get, run } from "../connection.js";

/**
 * Rows of sms_wallet (migrations/062_sms_packs.sql), one per salon or artist account. Plain SQL on a transaction
 * `client` handed in by the caller, so a pack credited in the same transaction that settles its payment, or an SMS
 * charged next to the row lock, can never be half done. Rules and the 200 a month live in billing/smsCredits.js.
 *
 * included_used counts this Persian month's SMS against the monthly allowance and starts again at 0 when period_key
 * changes; pack_credits is what the account bought and has not used. Both only ever move through these functions.
 */

/** Makes sure the account has a row, locks it, and starts a new month when `periodKey` differs from the stored one. */
export async function lockWallet(client, userId, periodKey) {
  await run(client, "INSERT INTO sms_wallet (user_id, period_key) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING", [Number(userId), periodKey]);
  const row = await get(client, "SELECT * FROM sms_wallet WHERE user_id = $1 FOR UPDATE", [Number(userId)]);
  if (row.period_key === periodKey) return row;
  return get(client, "UPDATE sms_wallet SET period_key = $2, included_used = 0, updated_at = NOW() WHERE user_id = $1 RETURNING *", [Number(userId), periodKey]);
}

/** A pack was paid: its credits are added (never expire). */
export async function addPackCredits(client, userId, credits, periodKey) {
  await lockWallet(client, userId, periodKey);
  return get(client, "UPDATE sms_wallet SET pack_credits = pack_credits + $2, updated_at = NOW() WHERE user_id = $1 RETURNING *", [Number(userId), Number(credits)]);
}

/** A pack was refunded: up to `credits` are taken back, never below zero. Returns how many were taken. */
export async function removePackCredits(client, userId, credits, periodKey) {
  const wallet = await lockWallet(client, userId, periodKey);
  const taken = Math.min(Number(wallet.pack_credits), Number(credits));
  if (taken > 0) await run(client, "UPDATE sms_wallet SET pack_credits = pack_credits - $2, updated_at = NOW() WHERE user_id = $1", [Number(userId), taken]);
  return taken;
}

/** What the account has now, without changing anything. A stored month that is over counts as a fresh month. */
export async function readWallet(db, userId, periodKey) {
  const row = await get(db, "SELECT period_key, included_used, pack_credits FROM sms_wallet WHERE user_id = $1", [Number(userId)]);
  if (!row) return { includedUsed: 0, packCredits: 0 };
  return { includedUsed: row.period_key === periodKey ? Number(row.included_used) : 0, packCredits: Number(row.pack_credits) };
}

/** One SMS to the account's clients is about to go: takes it from the month's allowance first, then from the packs. */
export async function takeOne(client, userId, periodKey, allowance, { blockWhenEmpty = false } = {}) {
  const wallet = await lockWallet(client, userId, periodKey);
  const includedLeft = Math.max(0, allowance - Number(wallet.included_used));
  if (includedLeft > 0) {
    await run(client, "UPDATE sms_wallet SET included_used = included_used + 1, updated_at = NOW() WHERE user_id = $1", [Number(userId)]);
    return { ok: true, source: "included" };
  }
  if (Number(wallet.pack_credits) > 0) {
    await run(client, "UPDATE sms_wallet SET pack_credits = pack_credits - 1, updated_at = NOW() WHERE user_id = $1", [Number(userId)]);
    return { ok: true, source: "pack" };
  }
  if (blockWhenEmpty) return { ok: false, source: "empty" };
  // Out of both, but this message must go (a booking answer): it goes at our cost and is still counted, so the usage is true.
  await run(client, "UPDATE sms_wallet SET included_used = included_used + 1, updated_at = NOW() WHERE user_id = $1", [Number(userId)]);
  return { ok: true, source: "over" };
}

/** The SMS did not go out after all: gives the one taken by takeOne() back. */
export async function giveBackOne(client, userId, periodKey, source) {
  const wallet = await lockWallet(client, userId, periodKey);
  if (source === "pack") {
    await run(client, "UPDATE sms_wallet SET pack_credits = pack_credits + 1, updated_at = NOW() WHERE user_id = $1", [Number(userId)]);
  } else if (Number(wallet.included_used) > 0) {
    await run(client, "UPDATE sms_wallet SET included_used = included_used - 1, updated_at = NOW() WHERE user_id = $1", [Number(userId)]);
  }
}
