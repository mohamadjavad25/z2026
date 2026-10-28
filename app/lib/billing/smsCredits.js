import { getDb, get, withTransaction } from "../db/connection.js";
import { ensureBillingTables, getBillingSettings } from "../db/repos/billing.js";
import { giveBackOne, readWallet, takeOne } from "../db/repos/smsWallet.js";
import { activeGateway } from "../payments/index.js";
import { smsMonthKey } from "./period.js";
import { SMS_INCLUDED_PER_MONTH, SMS_LOW_AT, SMS_PACKS, isBilledRole, rialToToman } from "./plans.js";

/**
 * The SMS an account may send to its own clients (owner's decisions of 2026-10-28):
 *  - each salon and artist account has SMS_INCLUDED_PER_MONTH a Persian month inside the subscription, starting again
 *    on the 1st; what is not used does not carry over;
 *  - packs the account bought are used after that and never expire;
 *  - when both are empty only the reminder is held back; the answer to a client's booking request, a cancellation or a
 *    proposal always goes, at our cost, and is still counted.
 * The account that pays is the one the client came through: a salon booking is the salon's, a booking the client
 * made straight with an artist is the artist's, even when the artist works in a salon (bookingSms.js decides).
 * None of this runs until subscriptions are really on (billing enabled and a gateway ready): before that nothing is
 * counted and no reminder is held back, because nobody can buy a pack yet. Deploying this changes nothing until then.
 */

export const monthKey = smsMonthKey;

async function enforced() {
  const settings = await getBillingSettings();
  return settings.enabled && Boolean(activeGateway());
}

/** What the card shows: what is left, from where, and the packs on sale. Never changes anything. */
export async function smsSummary(userId, now = new Date()) {
  await ensureBillingTables();
  const db = await getDb();
  const wallet = await readWallet(db, userId, monthKey(now));
  const includedLeft = Math.max(0, SMS_INCLUDED_PER_MONTH - wallet.includedUsed);
  const left = includedLeft + wallet.packCredits;
  return {
    included: SMS_INCLUDED_PER_MONTH,
    includedLeft,
    packCredits: wallet.packCredits,
    left,
    usedThisMonth: wallet.includedUsed,
    state: left <= 0 ? "empty" : left <= SMS_LOW_AT ? "low" : "ok",
    packs: SMS_PACKS.map((pack) => ({ id: pack.id, credits: pack.credits, title: pack.title, amountToman: rialToToman(pack.amountRial) }))
  };
}

/**
 * Takes one SMS from `payerUserId` before it is sent. Returns { ok: true, charge } (give `charge` back to
 * refundClientSms() if the SMS did not go out), or { ok: false } for a reminder that must not go because the account
 * has nothing left. A payer that is not a salon or artist (or nobody) is not charged: { ok: true, charge: null }.
 */
export async function chargeClientSms(payerUserId, { reminder = false, now = new Date() } = {}) {
  if (!payerUserId) return { ok: true, charge: null };
  // Until subscriptions are really on (billing enabled and a gateway ready) nothing is counted or held back: nobody can
  // buy a pack yet, and every account starts its first paid month with the full 200.
  if (!(await enforced())) return { ok: true, charge: null };
  await ensureBillingTables();
  const db = await getDb();
  const user = await get(db, "SELECT id, type FROM users WHERE id = $1", [Number(payerUserId)]);
  if (!user || !isBilledRole(user.type)) return { ok: true, charge: null };
  const key = monthKey(now);
  const taken = await withTransaction(null, (client) => takeOne(client, user.id, key, SMS_INCLUDED_PER_MONTH, { blockWhenEmpty: reminder }));
  if (!taken.ok) return { ok: false, charge: null };
  return { ok: true, charge: { userId: user.id, source: taken.source, periodKey: key } };
}

/** The SMS was not sent (provider down, pattern not set up): the account gets it back. */
export async function refundClientSms(charge) {
  if (!charge) return;
  await withTransaction(null, (client) => giveBackOne(client, charge.userId, charge.periodKey, charge.source));
}
