import { toPersianDigits } from "../../shared/lib/digits.js";

/**
 * Subscription plans for salons and artists (owner's decision 2026-10-16). Clients never pay.
 *
 * The one place prices live. Amounts are stored in RIAL because every Iranian gateway charges in rial;
 * the app shows toman (rial / 10). Rule: 6 months = one month free, 12 months = three months free, so the
 * yearly plan is always the cheapest per month. A change here changes what new checkouts charge; payments
 * already made keep the amount they were made with (it is copied onto the payment row).
 */
/** Free days for a salon or artist who signs up after billing is switched on (owner's decision 2026-10-28). */
export const TRIAL_DAYS = 14;
/** Free days for accounts that already existed when billing was switched on: they keep the 30 days promised at launch. */
export const LAUNCH_TRIAL_DAYS = 30;
export const DEFAULT_GRACE_DAYS = 3;
/** A new period runs this many days (not calendar months): simple to explain, and the receipt shows the exact end date. */
export const PERIOD_DAYS = { 1: 30, 6: 180, 12: 365 };

const MONTHLY_RIAL = { salon: 5_000_000, artist: 3_000_000 };
const PAID_MONTHS = { 1: 1, 6: 5, 12: 9 };
const GIFT_MONTHS = { 1: 0, 6: 1, 12: 3 };
const MONTHS_LABEL = { 1: "یک‌ماهه", 6: "شش‌ماهه", 12: "یک‌ساله" };
const ROLE_LABEL = { salon: "سالن", artist: "آرتیست" };

function buildPlan(role, months) {
  const amountRial = MONTHLY_RIAL[role] * PAID_MONTHS[months];
  const fullRial = MONTHLY_RIAL[role] * months;
  return {
    id: `${role}_${months}m`,
    role,
    months,
    days: PERIOD_DAYS[months],
    label: MONTHS_LABEL[months],
    title: `اشتراک ${MONTHS_LABEL[months]} ${ROLE_LABEL[role]}`,
    amountRial,
    monthlyRial: Math.round(amountRial / months),
    savingRial: fullRial - amountRial,
    giftMonths: GIFT_MONTHS[months]
  };
}

export const PLANS = Object.freeze(
  ["salon", "artist"].flatMap((role) => [1, 6, 12].map((months) => Object.freeze(buildPlan(role, months))))
);

/** The plan picked by default in the sheet: the middle one. */
export const PRESELECTED_MONTHS = 6;
/** The plan marked «به‌صرفه‌ترین». */
export const BEST_MONTHS = 12;

export const BILLED_ROLES = ["salon", "artist"];
export const isBilledRole = (type) => BILLED_ROLES.includes(type);

export function plansFor(role) {
  return PLANS.filter((plan) => plan.role === role);
}

export function getPlan(id) {
  return PLANS.find((plan) => plan.id === id) || null;
}

export const rialToToman = (rial) => Math.floor(Number(rial || 0) / 10);

/**
 * SMS packs (owner's decision 2026-10-28). Each salon or artist account may text its own clients SMS_INCLUDED_PER_MONTH
 * times a Persian month inside the subscription; a pack adds credits that never expire. Packs are paid through the same
 * gateway flow as a plan. Prices are in RIAL like the plans; the cost to us is about 222 toman an SMS (Faraz, 2026-10-28),
 * so these leave a margin. A change here changes what new checkouts charge, not payments already made.
 */
export const SMS_INCLUDED_PER_MONTH = 200;
/** Below this many left (all sources together) the card turns to «کم مونده». */
export const SMS_LOW_AT = 40;
const SMS_PACK_DEFS = [
  { credits: 100, amountRial: 400_000 },
  { credits: 300, amountRial: 1_050_000 }
];
export const SMS_PACKS = Object.freeze(SMS_PACK_DEFS.map((pack) => Object.freeze({
  id: `sms_${pack.credits}`,
  credits: pack.credits,
  amountRial: pack.amountRial,
  title: `بسته‌ی ${toPersianDigits(pack.credits)} پیامک`
})));
export const getSmsPack = (id) => SMS_PACKS.find((pack) => pack.id === id) || null;
