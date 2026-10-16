import { after } from "next/server";
import * as billing from "../db/repos/billing.js";
import { getDb, all } from "../db/connection.js";
import { activeGateway, gatewayById, gatewayLabel } from "../payments/index.js";
import { BEST_MONTHS, PRESELECTED_MONTHS, TRIAL_DAYS, getPlan, plansFor, rialToToman } from "./plans.js";
import { nextPeriod } from "./period.js";
import { reminderKind, reminderMessage } from "./reminders.js";
import { sendPushToUser } from "../push.js";
import { sendTemplateSms, smsProviderName } from "../sms.js";
import { adminPhoneList } from "../admin.js";
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

/** A payment as the app (or, with admin, the admin panel) sees it. Amounts in toman; no gateway internals for the app. */
export function presentPayment(row, { admin = false } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    receiptNo: row.receipt_no || "",
    status: row.status,
    source: row.source,
    plan: row.plan,
    title: row.plan_title,
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
    gatewayLabel: gatewayLabel(row.gateway)
  };
  if (!admin) return base;
  return {
    ...base,
    amountRial: Number(row.amount_rial),
    userId: row.user_id,
    userType: row.user_type,
    userName: row.user_name,
    userPhone: row.user_phone,
    gateway: row.gateway,
    authority: row.authority || "",
    note: row.note || "",
    adminLabel: row.admin_label || "",
    verifyAttempts: row.verify_attempts,
    lastVerifyAt: row.last_verify_at,
    detail: String(row.gateway_payload?.detail || ""),
    updatedAt: row.updated_at
  };
}

export function presentAccount(state) {
  if (!state) return null;
  const { access, coveredBy, open } = state;
  return { ...access, open, coveredBy };
}

/* ───────────────────────── app overview ───────────────────────── */

/**
 * GET /api/billing for a salon or artist: whether billing shows at all, where the account stands, and the three
 * plans with the dates each one would cover if bought now.
 */
export async function billingOverview(user, now = new Date()) {
  const state = await billing.getAccountState(user.id, now);
  if (!state) return { visible: false };
  const gateway = activeGateway();
  const [history, pending] = await Promise.all([billing.listUserPayments(user.id, 1), billing.latestPendingPayment(user.id)]);
  const { settings, access } = state;
  const plans = plansFor(user.type).map((plan) => {
    const period = nextPeriod({ now, accessEndsAt: access.accessEndsAt, days: plan.days });
    return {
      id: plan.id,
      label: plan.label,
      title: plan.title,
      months: plan.months,
      days: plan.days,
      amountToman: rialToToman(plan.amountRial),
      monthlyToman: rialToToman(plan.monthlyRial),
      savingToman: rialToToman(plan.savingRial),
      giftMonths: plan.giftMonths,
      best: plan.months === BEST_MONTHS,
      preselected: plan.months === PRESELECTED_MONTHS,
      startsAt: period.start.toISOString(),
      endsAt: period.end.toISOString()
    };
  });
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
    plans,
    pending: presentPayment(pending),
    lastPayment: presentPayment(history[0] || null)
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

/** Creates a pending payment for `planId`, asks the gateway to start it and returns where to send the payer. */
export async function startCheckout({ user, planId, origin }) {
  const plan = getPlan(planId);
  if (!plan || plan.role !== user.type) return fail(400, "این پلن برای حساب تو نیست.", "BAD_PLAN");
  const [settings, gateway] = [await billing.getBillingSettings(), activeGateway()];
  if (!settings.enabled || !gateway) return fail(409, "پرداخت اشتراک هنوز راه‌اندازی نشده است.", "BILLING_OFF");

  const payment = await billing.createPayment({ user, plan, gateway: gateway.id });
  const callbackUrl = `${origin}/api/billing/callback/${gateway.id}?pid=${payment.id}`;
  let started;
  try {
    started = await gateway.request({ payment, callbackUrl, description: `${plan.title} در فرفرو`, mobile: user.phone, origin });
  } catch (error) {
    started = { ok: false, detail: String(error?.message || error) };
  }
  const redirect = started?.ok ? safeRedirect(started.redirect, origin) : null;
  if (!started?.ok || !started.authority || !redirect) {
    await billing.failPayment(payment.id, "اتصال به درگاه برقرار نشد.", started?.detail || "bad gateway answer");
    logger.warn("billing checkout could not start", { paymentId: payment.id, gateway: gateway.id, detail: String(started?.detail || "").slice(0, 200) });
    return fail(502, "اتصال به درگاه پرداخت برقرار نشد. چند دقیقه بعد دوباره امتحان کن؛ پولی کم نشده است.", "GATEWAY_DOWN");
  }
  const saved = await billing.attachAuthority(payment.id, started.authority, started.payload || {});
  if (!saved) return fail(500, "شروع پرداخت ذخیره نشد؛ دوباره امتحان کن.", "SAVE_FAILED");
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

/** Receipt to the payer (push + SMS) and a "new payment" notice to every admin (push + SMS). */
export async function notifyPaid(payment) {
  const amount = formatTomanNumber(rialToToman(payment.amount_rial));
  const receipt = payment.receipt_no || "";
  const test = payment.gateway === "sandbox" ? " (آزمایشی)" : "";
  const tasks = [];
  if (payment.user_id) {
    tasks.push(sendPushToUser(payment.user_id, {
      title: "اشتراکت فعال شد",
      body: `${payment.plan_title}${test}، تا ${formatPersianLongDate(payment.period_end)}. شمارهٔ رسید ${receipt}.`,
      url: `/?billing=${payment.id}`
    }));
  }
  if (payment.user_phone && smsAllowedFor(payment)) {
    tasks.push(sendTemplateSms(payment.user_phone, "billing_receipt", { receipt, amount, until: formatPersianShortDate(payment.period_end) }));
  }
  const who = `${payment.user_type === "salon" ? "سالن" : "آرتیست"} ${payment.user_name || ""}`.trim();
  for (const admin of await adminUserIds()) {
    tasks.push(sendPushToUser(admin.id, {
      title: `پرداخت تازه${test}`,
      body: `${who}، ${payment.plan_title}، ${amount} تومان`,
      url: `/admin?p=payments&id=${payment.id}`
    }));
    if (smsAllowedFor(payment)) tasks.push(sendTemplateSms(admin.phone, "billing_admin", { amount, receipt, who: who.slice(0, 40) }));
  }
  await Promise.allSettled(tasks);
}

/** After an admin adds days: a short push to the account. */
export async function notifyGranted(payment) {
  if (!payment?.user_id) return;
  await sendPushToUser(payment.user_id, {
    title: "اشتراکت تمدید شد",
    body: `${toPersianDigits(payment.days)} روز اضافه شد؛ اشتراکت تا ${formatPersianLongDate(payment.period_end)} فعال است.`,
    url: `/?billing=${payment.id}`
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
  const db = await getDb();
  const covered = await billing.salonCover(db, due.filter((item) => item.row.type === "artist").map((item) => item.row.id), settings, now);
  let sent = 0;
  for (const { row, access, kind } of due) {
    if (covered.has(row.id)) continue;
    if (!(await billing.claimNotice(row.id, kind, access.accessEndsAt))) continue;
    const message = reminderMessage(kind, access, { graceDays: settings.graceDays });
    await Promise.allSettled([
      sendPushToUser(row.id, { title: message.title, body: message.body, url: "/?billing=plans" }),
      sendTemplateSms(row.phone, message.sms.key, message.sms.values)
    ]);
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
