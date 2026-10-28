import { closedAccountIds, getBillingSettings, testAccountIds } from "../db/repos/billing.js";
import { suspendedAccountIds } from "../db/repos/users.js";
import { activeGateway } from "../payments/index.js";

/**
 * The gate: what a salon or artist loses when the subscription and the grace days are over. Only two things:
 *   - they are left out of the public directory and of search (people who already connected still see them);
 *   - nobody but themselves can send them a new online booking request.
 * Their own calendar, existing bookings, customers, photos and settings keep working, and nothing is ever deleted.
 *
 * Enforced only while billing is switched on AND a gateway can take the payment: nobody is closed for not paying
 * while paying is impossible.
 */
export async function billingEnforced() {
  const settings = await getBillingSettings();
  return settings.enabled && Boolean(activeGateway());
}

export const PAGE_UNAVAILABLE_MESSAGE = "این صفحه فعلاً باز نیست.";

/**
 * Of these provider ids, the ones to leave out of directory lists and search: a suspended account always, and a
 * closed one (subscription over) only while billing is enforced. The owner's test numbers are always left out, so the
 * owner can use real accounts without showing up to real clients (their page link and booking still work).
 */
export async function hiddenProviderIds(userIds) {
  if (!userIds?.length) return new Set();
  const [suspended, closed, tests] = await Promise.all([
    suspendedAccountIds(userIds),
    billingEnforced().then((on) => (on ? closedAccountIds(userIds) : new Set())),
    testAccountIds(userIds)
  ]);
  return new Set([...suspended, ...closed, ...tests]);
}

/** Filters a list of rows by their provider id field. */
export async function withoutHiddenProviders(rows, idOf) {
  if (!rows?.length) return rows;
  const hidden = await hiddenProviderIds(rows.map(idOf));
  return hidden.size ? rows.filter((row) => !hidden.has(Number(idOf(row)))) : rows;
}

/**
 * Whether `providerUserId` can receive a new online booking request from someone else. Returns null when it can,
 * or { status, code, error } to send back.
 */
export async function onlineBookingBlock(providerUserId, kind = "salon") {
  const id = Number(providerUserId);
  if (!id) return null;
  // A suspended account takes no new request at all (nobody could answer it), whatever billing says.
  if ((await suspendedAccountIds([id])).has(id)) {
    return { status: 403, code: "PROVIDER_INACTIVE", error: PAGE_UNAVAILABLE_MESSAGE };
  }
  if (!(await billingEnforced())) return null;
  const closed = await closedAccountIds([id]);
  if (!closed.has(id)) return null;
  const who = kind === "artist" ? "این آرتیست" : "این سالن";
  return { status: 403, code: "PROVIDER_INACTIVE", error: `${who} فعلاً نوبت آنلاین نمی‌گیره؛ برای نوبت مستقیم بهش زنگ بزن.` };
}

/** Filters out the owner's test accounts only (phone search: a suspended or closed account is still found by its number). */
export async function withoutTestAccounts(rows, idOf) {
  if (!rows?.length) return rows;
  const tests = await testAccountIds(rows.map(idOf));
  return tests.size ? rows.filter((row) => !tests.has(Number(idOf(row)))) : rows;
}
