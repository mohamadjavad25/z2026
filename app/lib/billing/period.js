import { DEFAULT_GRACE_DAYS, LAUNCH_TRIAL_DAYS, TRIAL_DAYS } from "./plans.js";
import { getPersianDateParts } from "../../shared/lib/persianCalendar.js";

/**
 * Pure date rules for a salon's or artist's subscription. No database here, so every rule is unit-tested
 * (tests/unit/billingPeriod.test.js) and the API, the gate and the reminders all use the same answers.
 *
 * Access runs until the later of two dates:
 *   - the end of the free period: 14 days from sign-up, or 30 days from the day billing was switched on for
 *     accounts that existed before that (nobody is surprised by a bill the day it launches);
 *   - `paid_until`: the end of the last paid (or admin-granted) period.
 * After that come a few grace days where everything still works, then the account is "expired".
 */
export const DAY_MS = 86_400_000;

const toMs = (value) => {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * Accounts made after billing was switched on get TRIAL_DAYS from sign-up. Accounts made before get LAUNCH_TRIAL_DAYS
 * from the switch-on day, as promised at launch. `trialDays` overrides both (tests and the admin view).
 */
export function trialEndsAt({ createdAt, launchedAt, trialDays }) {
  const created = toMs(createdAt);
  const launched = toMs(launchedAt);
  const existing = launched > 0 && created < launched;
  const days = trialDays ?? (existing ? LAUNCH_TRIAL_DAYS : TRIAL_DAYS);
  return new Date(Math.max(created, launched) + days * DAY_MS);
}

/** "1405-08": the Persian year and month in Tehran, the unit the monthly SMS allowance restarts on (smsCredits.js). */
export function smsMonthKey(now = new Date()) {
  const { year, month } = getPersianDateParts(now);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Whole days left until `end`, counting a started day as a day ("12 hours left" is 1 day). Never negative. */
export function daysUntil(end, now) {
  const left = toMs(end) - toMs(now);
  return left > 0 ? Math.ceil(left / DAY_MS) : 0;
}

/**
 * state: "trial" (free month), "active" (paid period running), "grace" (ended, a few days to pay),
 * "expired" (hidden from search, no new online bookings).
 */
export function computeAccess({ now = new Date(), createdAt, launchedAt = null, paidUntil = null, graceDays = DEFAULT_GRACE_DAYS, trialDays }) {
  const nowMs = toMs(now);
  const trialEnd = trialEndsAt({ createdAt, launchedAt, trialDays });
  const paidEndMs = toMs(paidUntil);
  const accessEndMs = Math.max(trialEnd.getTime(), paidEndMs);
  const graceEndMs = accessEndMs + Math.max(0, Number(graceDays) || 0) * DAY_MS;
  let state = "expired";
  if (nowMs < accessEndMs) state = paidEndMs > nowMs ? "active" : "trial";
  else if (nowMs < graceEndMs) state = "grace";
  return {
    state,
    open: state !== "expired",
    trialEndsAt: trialEnd.toISOString(),
    paidUntil: paidEndMs ? new Date(paidEndMs).toISOString() : null,
    accessEndsAt: new Date(accessEndMs).toISOString(),
    graceEndsAt: new Date(graceEndMs).toISOString(),
    daysLeft: daysUntil(accessEndMs, nowMs),
    graceDaysLeft: state === "grace" ? daysUntil(graceEndMs, nowMs) : 0
  };
}

/**
 * Where a newly bought period goes: right after the current access ends (no free days are lost by paying
 * early), or from now when access already ended (grace days are not charged for).
 */
export function nextPeriod({ now = new Date(), accessEndsAt, days }) {
  const start = Math.max(toMs(now), toMs(accessEndsAt));
  return { start: new Date(start), end: new Date(start + Number(days) * DAY_MS) };
}

/**
 * What a refund of one paid period comes to (terms, section 4): the days of it not used yet, and the same share of
 * what was paid (the plan's own daily price, so gift months in longer plans are priced fairly). A period that has not
 * started yet (bought ahead) comes back whole. A started day counts as used.
 */
export function refundQuote({ amountRial, days, periodStart, periodEnd, now = new Date() }) {
  const total = Math.max(0, Math.round(Number(days) || 0));
  const amount = Math.max(0, Number(amountRial) || 0);
  if (!total || !toMs(periodEnd)) return { days: 0, amountRial: 0 };
  const from = Math.max(toMs(now), toMs(periodStart));
  const unused = Math.min(total, Math.max(0, Math.floor((toMs(periodEnd) - from) / DAY_MS)));
  // Whole toman: the gateways refund in toman steps.
  return { days: unused, amountRial: Math.round((amount * unused) / total / 10) * 10 };
}

/** «FR-1405-000042»: the Persian year it was paid in, then the payment id. Unique because the id is. */
export function receiptNumber(paymentId, paidAt = new Date()) {
  const { year } = getPersianDateParts(paidAt instanceof Date ? paidAt : new Date(paidAt));
  return `FR-${year}-${String(paymentId).padStart(6, "0")}`;
}
