import { after } from "next/server";
import * as billing from "../db/repos/billing.js";
import { getDb, all } from "../db/connection.js";
import { activeGateway, gatewayById, gatewayLabel } from "../payments/index.js";
import { BEST_MONTHS, LAUNCH_TRIAL_DAYS, PRESELECTED_MONTHS, TRIAL_DAYS, getPlan, getSmsPack, plansFor, rialToToman } from "./plans.js";
import { nextPeriod, refundQuote } from "./period.js";
import { smsSummary } from "./smsCredits.js";
import { reminderKind, reminderMessage } from "./reminders.js";
import { pushReachedApp, sendPushToUser } from "../push.js";
import { sendTemplateSms, smsProviderName } from "../sms.js";
import { adminPhoneList } from "../admin.js";
import { pushAdmins } from "../adminPush.js";
import { todayCounts } from "../db/repos/adminNews.js";
import { logger } from "../logger.js";
import { formatPersianLongDate, formatPersianShortDate } from "../../shared/lib/billingFormat.js";
import { formatTomanNumber } from "../../shared/lib/money.js";
import { toPersianDigits } from "../../shared/lib/digits.js";

/**
 * Everything around a subscription payment that is more than one database call: starting a checkout at the gateway,
 * verifying and settling, telling the payer and the admins, and the hourly sweep (re-check pending payments, send
 * reminders). Route handlers stay thin and call these.
 */

/** Runs `task` after the response is sent (Next's after()), so a slow SMS never delays the payer's page. */
function runAfterResponse(task) {
  const safe = () => Promise.resolve().then(task).catch((error) => logger.error("billing background task failed", { error }));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/** The site's own address for gateway callbacks: NEXT_PUBLIC_SITE_URL when it is set for real, otherwise the request's origin. */
export function publicOrigin(request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//.test(configured) && !configured.includes("frfro.example.com")) return configured;
  return request.nextUrl.origin;
}

/* ───────────────────────── shaping ───────────────────────── */

/**
 * A payment as the app (or, with admin, the admin panel) sees it. Amounts in toman; no gateway internals for the app.
 * When a salon paid for an artist, `viewerId` decides which side is shown: the artist sees «پرداخت توسط <salon>»
 * (paidBy), the salon sees «برای <artist>» (paidFor).
 */
export function presentPayment(row, { admin = false, viewerId = null } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    receiptNo: row.receipt_no || "",
    status: row.status,
    source: row.source,
    plan: row.plan,
    title: row.plan_title,
    kind: row.kind || "plan",
    smsCredits: Number(row.sms_credits || 0),
    days: row.days,
    amountToman: rialToToman(row.amount_rial),
    refId: row.ref_id || "",
    cardPan: row.card_pan || "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    failure: row.failure || "",
    sandbox: row.gateway === "sandbox",
    gatewayLabel: gatewayLabel(row.gateway),
    paidBy: row.payer_user_id && viewerId && Number(row.payer_user_id) !== Number(viewerId) ? row.payer_name || "سالن" : "",
    paidFor: row.payer_user_id && viewerId && Number(row.payer_user_id) === Number(viewerId) ? row.user_name || "آرتیست" : "",
    paidForUserId: row.payer_user_id && viewerId && Number(row.payer_user_id) === Number(viewerId) ? row.user_id : null,
    refundedAt: row.refunded_at || null,
    refundToman: rialToToman(row.refund_rial || 0),
    refundDays: Number(row.refund_days || 0)
  };
  if (!admin) return base;
  return {
    ...base,
    amountRial: Number(row.amount_rial),
    userId: row.user_id,
    userType: row.user_type,
    userName: row.user_name,
    userPhone: row.user_phone,
    payerUserId: row.payer_user_id || null,
    payerName: row.payer_name || "",
    gateway: row.gateway,
    authority: row.authority || "",
    note: row.note || "",
    adminLabel: row.admin_label || "",
    verifyAttempts: row.verify_attempts,
    lastVerifyAt: row.last_verify_at,
    detail: String(row.gateway_payload?.detail || ""),
    refundNote: row.refund_note || "",
    refundAdmin: row.refund_admin || "",
    // What a refund would come to today (terms, section 4); the admin dialog starts from it.
    refundQuote: row.status === "paid" && !row.refunded_at && Number(row.amount_rial) > 0
      ? row.kind === "sms_pack"
        ? { days: 0, amountToman: rialToToman(row.amount_rial) }
        : (({ days, amountRial }) => ({ days, amountToman: rialToToman(amountRial) }))(refundQuote({ amountRial: Number(row.amount_rial), days: row.days, periodStart: row.period_start, periodEnd: row.period_end }))
      : null,
    updatedAt: row.updated_at
  };
}

export function presentAccount(state) {
  if (!state) return null;
  return { ...state.access, open: state.open };
}

/** The plans of one role with the dates each would cover if bought now for an account whose access ends at `accessEndsAt`. */
function plansWithDates(role, accessEndsAt, now) {
  return plansFor(role).map((plan) => {
    const period = nextPeriod({ now, accessEndsAt, days: plan.days });
    // Per month, shown rounded to the thousand («ماهی حدود ۴۱۷٬۰۰۰»); the amount charged is never rounded.
    const exactMonthly = rialToToman(plan.amountRial) / plan.months;
    const monthlyToman = Math.round(exactMonthly / 1000) * 1000;
    return {
      id: plan.id,
      label: plan.label,
      title: plan.title,
      months: plan.months,
      days: plan.days,
      amountToman: rialToToman(plan.amountRial),
      monthlyToman,
      monthlyApprox: monthlyToman !== exactMonthly,
      savingToman: rialToToman(plan.savingRial),
      giftMonths: plan.giftMonths,
      best: plan.months === BEST_MONTHS,
      preselected: plan.months === PRESELECTED_MONTHS,
      startsAt: period.start.toISOString(),
      endsAt: period.end.toISOString()
    };
  });
}

/* ───────────────────────── app overview ───────────────────────── */

/**
 * GET /api/billing for a salon or artist: whether billing shows at all, where the account stands, and the three
 * plans with the dates each one would cover if bought now. For a salon also `team`: the artists on its team with an
 * account of their own, each with their state and the artist plans for them (a salon may pay for them; optional).
 */
export async function billingOverview(user, now = new Date()) {
  const state = await billing.getAccountState(user.id, now);
  if (!state) return { visible: false };
  // The owner's own test number: no plans, no counting, no banner; Settings just says so (owner's request 2026-10-28).
  if (state.access.comped) return { visible: false, testAccount: true, role: user.type };
  const gateway = activeGateway();
  const [history, pending] = await Promise.all([billing.listUserPayments(user.id, 20), billing.latestPendingPayment(user.id)]);
  // The account's own subscription: a receipt a salon holds for an artist's plan is not the salon's last payment.
  const lastPaid = history.find((row) => row.status === "paid" && row.kind !== "sms_pack" && Number(row.user_id) === Number(user.id)) || null;
  const { settings, access } = state;
  // Billing is off and this account never paid: nothing to pay or count yet, but Settings still tells the owner what it
  // will cost and that the free month starts the day billing is switched on (owner's request 2026-10-28).
  if (!settings.enabled && history.length === 0) {
    // Before payment is switched on every account that exists then gets LAUNCH_TRIAL_DAYS from that day (accounts made later get TRIAL_DAYS).
    return { visible: false, preview: true, enabled: false, role: user.type, trialDays: LAUNCH_TRIAL_DAYS, graceDays: settings.graceDays, plans: plansWithDates(user.type, access.accessEndsAt, now) };
  }
  const team = user.type === "salon"
    ? (await billing.listTeamArtists(user.id, now)).map((artist) => ({
        id: artist.id,
        name: artist.name,
        avatarUrl: artist.has_avatar ? `/api/media/avatar/${artist.id}` : "",
        account: { ...artist.access },
        plans: plansWithDates("artist", artist.access.accessEndsAt, now)
      }))
    : [];
  return {
    visible: settings.enabled || history.length > 0,
    enabled: settings.enabled,
    checkoutReady: settings.enabled && Boolean(gateway),
    enforced: settings.enabled && Boolean(gateway),
    sandbox: Boolean(gateway?.isSandbox),
    graceDays: settings.graceDays,
    trialDays: TRIAL_DAYS,
    role: user.type,
    account: presentAccount(state),
    plans: plansWithDates(user.type, access.accessEndsAt, now),
    team,
    sms: await smsSummary(user.id, now),
    pending: presentPayment(pending, { viewerId: user.id }),
    lastPayment: presentPayment(lastPaid, { viewerId: user.id })
  };
}

/* ───────────────────────── checkout ───────────────────────── */

const fail = (status, error, code) => ({ ok: false, status, error, code });

function safeRedirect(redirect, origin) {
  const method = redirect?.method === "POST" ? "POST" : "GET";
  const url = String(redirect?.url || "");
  if (!(url.startsWith("https://") || url.startsWith(`${origin}/`))) return null;
  const fields = method === "POST" && redirect.fields && typeof redirect.fields === "object"
    ? Object.fromEntries(Object.entries(redirect.fields).map(([key, value]) => [String(key), String(value)]))
    : undefined;
  return { method, url, ...(fields ? { fields } : {}) };
}

/**
 * Creates a pending payment for `planId`, asks the gateway to start it and returns where to send the payer.
 * `forUserId`: a salon paying for an artist on its own team (optional for the salon; otherwise artists pay for
 * themselves). The plan must then be an artist plan; the artist's subscription is extended and the salon is the payer.
 */
export async function startCheckout({ user, planId, origin, forUserId = null }) {
  let account = user;
  let payer = null;
  if (forUserId && Number(forUserId) !== Number(user.id)) {
    if (user.type !== "salon") return fail(403, "فقط سالن می‌تونه اشتراک آرتیست‌های تیمش رو بده.", "NOT_SALON");
    if (!(await billing.isTeamArtist(user.id, forUserId))) return fail(403, "این آرتیست توی تیم سالنت نیست.", "NOT_TEAM");
    const state = await billing.getAccountState(forUserId);
    if (!state) return fail(404, "حساب این آرتیست رو پیدا نکردیم.", "NO_ACCOUNT");
    account = state.user;
    payer = user;
  }
  const plan = getPlan(planId);
  if (!plan || plan.role !== account.type) return fail(400, payer ? "این پلن مال آرتیست نیست." : "این پلن مال حساب تو نیست.", "BAD_PLAN");
  const [settings, gateway] = [await billing.getBillingSettings(), activeGateway()];
  if (!settings.enabled || !gateway) return fail(409, "خرید اشتراک هنوز باز نشده.", "BILLING_OFF");

  const payment = await billing.createPayment({ user: account, plan, gateway: gateway.id, payer });
  const description = payer ? `${plan.title} برای ${String(account.name || "").slice(0, 40)} در فرفرو` : `${plan.title} در فرفرو`;
  return beginGateway({ payment, gateway, origin, description, mobile: user.phone });
}

/**
 * Creates a pending payment for an SMS pack (always for the signed-in account's own wallet) and sends the payer to the
 * gateway. Same rules as a plan: the amount comes from the pack on the server, and paid means only what verify() says.
 */
export async function startPackCheckout({ user, packId, origin }) {
  const pack = getSmsPack(packId);
  if (!pack) return fail(400, "این بسته پیدا نشد.", "BAD_PACK");
  const [settings, gateway] = [await billing.getBillingSettings(), activeGateway()];
  if (!settings.enabled || !gateway) return fail(409, "خرید بسته‌ی پیامک هنوز باز نشده.", "BILLING_OFF");
  const payment = await billing.createPackPayment({ user, pack, gateway: gateway.id });
  return beginGateway({ payment, gateway, origin, description: `${pack.title} در فرفرو`, mobile: user.phone });
}

/** Asks the gateway to start `payment` and saves its token; shared by plans and packs. */
async function beginGateway({ payment, gateway, origin, description, mobile }) {
  const callbackUrl = `${origin}/api/billing/callback/${gateway.id}?pid=${payment.id}`;
  let started;
  try {
    started = await gateway.request({ payment, callbackUrl, description, mobile, origin });
  } catch (error) {
    started = { ok: false, detail: String(error?.message || error) };
  }
  const redirect = started?.ok ? safeRedirect(started.redirect, origin) : null;
  if (!started?.ok || !started.authority || !redirect) {
    await billing.failPayment(payment.id, "اتصال به درگاه برقرار نشد.", started?.detail || "bad gateway answer");
    logger.warn("billing checkout could not start", { paymentId: payment.id, gateway: gateway.id, detail: String(started?.detail || "").slice(0, 200) });
    return fail(502, "درگاه بانک جواب نداد. چند دقیقه دیگه دوباره بزن؛ پولی کم نشده.", "GATEWAY_DOWN");
  }
  const saved = await billing.attachAuthority(payment.id, started.authority, started.payload || {});
  if (!saved) return fail(500, "پرداخت شروع نشد؛ دوباره بزن.", "SAVE_FAILED");
  return { ok: true, paymentId: payment.id, redirect };
}

/* ───────────────────────── verify + settle ───────────────────────── */

// A "not paid" answer is final only once the payer is back from the bank (the callback) or the checkout is older than
// this. Before that the payer may still be on the bank's page: some gateways answer "not paid" for a payment that is
// simply not finished yet, and writing it off then would leave a real payment, made a minute later, unrecorded.
const FAIL_FINAL_AFTER_MS = 30 * 60 * 1000;

/**
 * Asks the payment's own gateway whether it was paid and records the answer. Only a pending payment with a gateway
 * token is asked; anything else is returned as it is. When this call is the one that settles it as paid, the payer
 * and the admins are told (after the response, or awaited when `awaitNotify`, as the cron does).
 * `fromCallback`: the payer has just come back from the bank, so a "not paid" answer is final.
 */
export async function verifyAndSettle(payment, { now = new Date(), awaitNotify = false, fromCallback = false } = {}) {
  if (!payment || payment.status !== "pending" || !payment.authority) return { payment, settled: false };
  const gateway = gatewayById(payment.gateway);
  let verification;
  if (!gateway || !gateway.configured()) {
    verification = { status: "unknown", detail: `gateway ${payment.gateway} is not configured` };
  } else {
    try {
      verification = await gateway.verify({ payment });
    } catch (error) {
      verification = { status: "unknown", detail: String(error?.message || error).slice(0, 200) };
    }
  }
  const young = now.getTime() - new Date(payment.created_at).getTime() < FAIL_FINAL_AFTER_MS;
  if (verification.status === "failed" && !fromCallback && young) {
    verification = { status: "unknown", detail: `not paid yet (${String(verification.detail || "").slice(0, 120)})` };
  }
  const result = await billing.settlePayment(payment.id, verification, now);
  if (result.settled && result.payment?.status === "paid") {
    if (awaitNotify) await notifyPaid(result.payment).catch((error) => logger.error("billing notify failed", { error }));
    else runAfterResponse(() => notifyPaid(result.payment));
  }
  if (result.settled && result.payment?.status === "failed" && result.payment.gateway_payload?.paidAmountRial !== undefined) {
    logger.error("billing amount mismatch", { paymentId: payment.id, expected: Number(payment.amount_rial), paid: result.payment.gateway_payload.paidAmountRial });
  }
  return result;
}

/** A pending payment the payer is looking at: asked again at most every few seconds, so polling never floods the gateway. */
export async function refreshIfPending(payment, now = new Date()) {
  if (!payment || payment.status !== "pending" || !payment.authority) return payment;
  const last = payment.last_verify_at ? new Date(payment.last_verify_at).getTime() : 0;
  if (now.getTime() - last < 4000) return payment;
  const { payment: updated } = await verifyAndSettle(payment, { now });
  return updated || payment;
}

/**
 * The gateway sent the payer back. The return parameters are only used to find the payment (its id and the gateway's
 * token must both match); whether it was paid comes from verify(), never from the parameters.
 */
export async function handleCallback(gatewayId, paymentId, params) {
  const gateway = gatewayById(gatewayId);
  const payment = paymentId ? await billing.getPayment(paymentId) : null;
  if (!gateway || !payment || payment.gateway !== gateway.id) return null;
  const parsed = gateway.parseCallback(params || {});
  if (!parsed?.authority || parsed.authority !== payment.authority) return null;
  if (payment.status !== "pending") return payment;
  const { payment: settled } = await verifyAndSettle(payment, { fromCallback: true });
  return settled || payment;
}

/* ───────────────────────── notifications ───────────────────────── */

async function adminUserIds() {
  const phones = adminPhoneList();
  if (!phones.length) return [];
  const db = await getDb();
  const rows = await all(db, "SELECT id, phone FROM users WHERE phone = ANY($1::text[])", [phones]);
  return rows;
}

/** Sandbox payments never cost a real SMS (only the "test" provider, which sends nothing, records them). */
const smsAllowedFor = (payment) => payment.gateway !== "sandbox" || smsProviderName() === "test";

/**
 * Receipt to the payer (push + SMS) and a "new payment" notice to every admin (push, and an SMS unless the «فرفرو مدیر» app got it). When a salon paid for an
 * artist, the salon gets the receipt and the artist a push saying the salon renewed their subscription.
 */
export async function notifyPaid(payment) {
  const amount = formatTomanNumber(rialToToman(payment.amount_rial));
  const receipt = payment.receipt_no || "";
  const test = payment.gateway === "sandbox" ? " (آزمایشی)" : "";
  const pack = payment.kind === "sms_pack";
  const until = pack ? "" : formatPersianLongDate(payment.period_end);
  const tasks = [];
  let receiptPhone = payment.user_phone;
  let receiptPush = null;
  if (payment.payer_user_id) {
    const db = await getDb();
    const [payer] = await all(db, "SELECT id, phone FROM users WHERE id = $1", [payment.payer_user_id]);
    receiptPhone = payer?.phone || "";
    if (payer) {
      receiptPush = sendPushToUser(payer.id, {
        title: `اشتراک ${payment.user_name || "آرتیست"} فعال شد`,
        body: `${payment.plan_title}${test}، تا ${until}. شمارهٔ رسید ${receipt}.`,
        url: `/?billing=${payment.id}`
      });
      tasks.push(receiptPush);
    }
    if (payment.user_id) {
      tasks.push(sendPushToUser(payment.user_id, {
        title: `${payment.payer_name || "سالنت"} اشتراکت رو خرید`,
        body: `${payment.plan_title}${test}؛ اشتراکت تا ${until} فعاله.`,
        url: "/?billing=history"
      }));
    }
  } else if (payment.user_id) {
    receiptPush = sendPushToUser(payment.user_id, {
      title: pack ? "پیامک‌هات رسید" : "اشتراکت فعال شد",
      body: pack
        ? `${payment.plan_title}${test} به حسابت اضافه شد. شمارهٔ رسید ${receipt}.`
        : `${payment.plan_title}${test}، تا ${until}. شمارهٔ رسید ${receipt}.`,
      url: `/?billing=${payment.id}`
    });
    tasks.push(receiptPush);
  }
  // The receipt SMS is skipped when the push reached the payer's Android app (the receipt is also in the app). A pack's
  // receipt is the push and the receipt page only: a text for every pack would eat the very SMS the pack was bought for.
  if (!pack && receiptPhone && smsAllowedFor(payment) && !(await pushReachedApp(receiptPush))) {
    tasks.push(sendTemplateSms(receiptPhone, "billing_receipt", { receipt, amount, until: formatPersianShortDate(payment.period_end) }));
  }
  const account = `${payment.user_type === "salon" ? "سالن" : "آرتیست"} ${payment.user_name || ""}`.trim();
  const who = payment.payer_user_id ? `${payment.payer_name || "سالن"} برای ${account}` : account;
  // Every payment rings (money), each replacing the last one with the day's total (adminNews.js).
  const today = test ? null : await todayCounts().catch(() => null);
  const dayTotal = today?.payments.count ? ` · امروز ${toPersianDigits(String(today.payments.count))} تا، ${formatTomanNumber(rialToToman(today.payments.rial))} تومان` : "";
  const adminNews = {
    title: `پرداخت تازه${test}`,
    body: `${who}، ${payment.plan_title}، ${amount} تومان${dayTotal}`,
    url: `/admin?p=payments&id=${payment.id}`,
    tag: "payments"
  };
  // Admins with the «فرفرو مدیر» app get it there and no SMS (adminPush.js).
  const inAdminApp = await pushAdmins(adminNews);
  for (const admin of await adminUserIds()) {
    tasks.push(sendPushToUser(admin.id, adminNews));
    if (smsAllowedFor(payment) && !inAdminApp.has(admin.phone)) tasks.push(sendTemplateSms(admin.phone, "billing_admin", { amount, receipt, who: who.slice(0, 40) }));
  }
  await Promise.allSettled(tasks);
}

/** After an admin adds days: a short push to the account. */
export async function notifyGranted(payment) {
  if (!payment?.user_id) return;
  await sendPushToUser(payment.user_id, {
    title: "اشتراکت تمدید شد",
    body: `${toPersianDigits(payment.days)} روز اضافه شد؛ اشتراکت تا ${formatPersianLongDate(payment.period_end)} فعاله.`,
    url: `/?billing=${payment.id}`
  }).catch(() => {});
}

/** After an admin records a refund: a short push to whoever paid. */
export async function notifyRefunded(payment) {
  const to = payment?.payer_user_id || payment?.user_id;
  if (!to) return;
  const amount = formatTomanNumber(rialToToman(payment.refund_rial));
  const days = Number(payment.refund_days) ? ` و ${toPersianDigits(payment.refund_days)} روز از اشتراک کم شد` : "";
  await sendPushToUser(to, {
    title: "بازپرداخت ثبت شد",
    body: `${amount} تومان از رسید ${payment.receipt_no || ""} به کارتت برمی‌گرده${days}.`,
    url: "/?billing=history"
  }).catch(() => {});
}

/* ───────────────────────── hourly sweep ───────────────────────── */

async function sendReminders(now, settings) {
  const due = [];
  for (const row of await billing.listBilledAccounts()) {
    const access = billing.accessOf(row, row.paid_until, settings, now);
    const kind = reminderKind(access, now);
    if (kind) due.push({ row, access, kind });
  }
  if (!due.length) return 0;
  let sent = 0;
  for (const { row, access, kind } of due) {
    if (!(await billing.claimNotice(row.id, kind, access.accessEndsAt))) continue;
    const message = reminderMessage(kind, access, { graceDays: settings.graceDays });
    const push = sendPushToUser(row.id, { title: message.title, body: message.body, url: "/?billing=plans" }).catch(() => null);
    if (!(await pushReachedApp(push))) await sendTemplateSms(row.phone, message.sms.key, message.sms.values).catch(() => null);
    sent += 1;
  }
  return sent;
}

/**
 * Called by the scheduler (POST /api/cron/billing, hourly):
 *  1. asks the gateway again about pending payments whose payer never came back (closed the browser, lost signal);
 *  2. closes checkouts that never reached the gateway or stayed unanswered for three days;
 *  3. sends the due reminders, only while billing is on and payable (no "pay now" when paying is impossible).
 */
export async function sweepBilling(now = new Date()) {
  const result = { checked: 0, paid: 0, failed: 0, closed: 0, reminders: 0 };
  for (const payment of await billing.listPaymentsToReverify(now)) {
    const { payment: updated, settled } = await verifyAndSettle(payment, { now, awaitNotify: true });
    result.checked += 1;
    if (settled && updated?.status === "paid") result.paid += 1;
    if (settled && updated?.status === "failed") result.failed += 1;
  }
  result.closed = await billing.closeAbandonedPayments(now);
  const settings = await billing.getBillingSettings();
  if (settings.enabled && activeGateway()) result.reminders = await sendReminders(now, settings);
  return result;
}
