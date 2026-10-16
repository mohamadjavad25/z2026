import { closedAccountIds, getBillingSettings } from "../db/repos/billing.js";
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

/** Of these provider ids, the ones to leave out of directory lists and search (empty while not enforced). */
export async function hiddenProviderIds(userIds) {
  if (!userIds?.length || !(await billingEnforced())) return new Set();
  return closedAccountIds(userIds);
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
  if (!id || !(await billingEnforced())) return null;
  const closed = await closedAccountIds([id]);
  if (!closed.has(id)) return null;
  const who = kind === "artist" ? "این آرتیست" : "این سالن";
  return { status: 403, code: "PROVIDER_INACTIVE", error: `${who} فعلاً نوبت آنلاین نمی‌گیرد. برای گرفتن نوبت، مستقیم با خودش تماس بگیر.` };
}
