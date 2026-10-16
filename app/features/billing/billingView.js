import { formatDaysLeft, formatPersianLongDate } from "../../shared/lib/billingFormat.js";
import { toPersianDigits } from "../../shared/lib/digits.js";

/**
 * What the subscription card (Settings) and the reminder bar (home) say, from GET /api/billing. Pure, so every state
 * is unit-tested (tests/unit/billingView.test.js).
 *
 * tone: trial | active | warn | danger | covered | soon. While billing is on but no gateway can take a payment yet
 * ("not enforced"), nothing is closed, so an ended free month reads calm ("soon"), never alarming.
 */
const TRIAL_DAYS_FALLBACK = 30;

export function accountView(overview) {
  if (!overview?.visible || !overview.account) return null;
  const account = overview.account;
  const until = formatPersianLongDate(account.accessEndsAt);
  const cover = account.coveredBy;
  const ready = Boolean(overview.checkoutReady);
  const cta = (label, emphasis = "primary") => ({ label: ready ? label : "پرداخت به‌زودی فعال می‌شود", emphasis, disabled: !ready });

  if (account.state === "trial") {
    return {
      tone: "trial",
      badge: "ماه رایگان",
      title: `${formatDaysLeft(account.daysLeft)} از ماه رایگانت مانده`,
      sub: `تا ${until}. هر پلنی بخری از همان روز شروع می‌شود و روزی از ماه رایگانت از دست نمی‌رود.`,
      note: cover ? `عضو ${cover.salonName} هستی؛ بعد از ماه رایگان هم از طرف سالن فعال می‌مانی.` : "",
      meter: Math.min(1, Math.max(0, account.daysLeft / (overview.trialDays || TRIAL_DAYS_FALLBACK))),
      action: cta("خرید اشتراک", account.daysLeft <= 5 ? "primary" : "secondary")
    };
  }
  if (account.state === "active") {
    const total = Number(overview.lastPayment?.days) || 0;
    return {
      tone: "active",
      badge: "فعال",
      title: `اشتراکت تا ${until} فعال است`,
      sub: `${formatDaysLeft(account.daysLeft)} مانده.${overview.lastPayment?.title ? ` آخرین پرداخت: ${overview.lastPayment.title}.` : ""}`,
      note: "",
      meter: total ? Math.min(1, Math.max(0, account.daysLeft / total)) : null,
      action: cta("تمدید اشتراک", account.daysLeft <= 5 ? "primary" : "secondary")
    };
  }
  if (cover) {
    return {
      tone: "covered",
      badge: "از طرف سالن",
      title: `اشتراکت از طرف ${cover.salonName} فعال است`,
      sub: "تا وقتی عضو این سالن هستی، لازم نیست جدا پرداخت کنی. اگر جدا هم کار می‌کنی، اشتراک شخصی بخر.",
      note: "",
      meter: null,
      action: cta("خرید اشتراک شخصی", "secondary")
    };
  }
  if (!overview.enforced) {
    return {
      tone: "soon",
      badge: "ماه رایگان تمام شد",
      title: "پرداخت اشتراک به‌زودی فعال می‌شود",
      sub: "تا آن موقع همه‌چیز مثل قبل کار می‌کند و چیزی بسته نمی‌شود.",
      note: "",
      meter: null,
      action: cta("خرید اشتراک")
    };
  }
  if (account.state === "grace") {
    return {
      tone: "warn",
      badge: "مهلت تمدید",
      title: "اشتراکت تمام شده",
      sub: `${formatDaysLeft(account.graceDaysLeft)} فرصت داری تمدید کنی. بعد از آن در جست‌وجو دیده نمی‌شوی و نوبت آنلاین نمی‌گیری.`,
      note: "",
      meter: null,
      action: cta("تمدید اشتراک")
    };
  }
  return {
    tone: "danger",
    badge: "غیرفعال",
    title: "اشتراکت غیرفعال است",
    sub: "در جست‌وجو دیده نمی‌شوی و نوبت آنلاین نمی‌گیری. نوبت‌ها، مشتری‌ها و عکس‌هایت سر جایشان است و با خرید اشتراک همان لحظه همه‌چیز برمی‌گردد.",
    note: "",
    meter: null,
    action: cta("خرید اشتراک")
  };
}

/**
 * The bar on the home page: only when something needs the owner's attention (a payment being checked, five days or
 * fewer left, grace, closed). `key` changes when the situation changes, so a closed bar comes back for the next step.
 */
export function bannerView(overview) {
  if (!overview?.visible || !overview.account) return null;
  if (overview.pending) {
    return { key: `pending-${overview.pending.id}`, tone: "info", text: "پرداختت در حال بررسی است.", action: "دیدن نتیجه", kind: "result", paymentId: overview.pending.id };
  }
  const account = overview.account;
  // Nothing to warn about while nobody can pay yet, or when a salon's subscription covers this artist.
  if (!overview.enforced || account.coveredBy) return null;
  const key = `${account.state}-${account.accessEndsAt}`;
  if (account.state === "trial" || account.state === "active") {
    if (account.daysLeft > 5) return null;
    const lastDay = account.daysLeft <= 1;
    return {
      key: `${key}-${lastDay ? "1" : "5"}`,
      tone: lastDay ? "warn" : "info",
      text: account.state === "trial"
        ? `${formatDaysLeft(account.daysLeft)} از ماه رایگانت مانده.`
        : `اشتراکت ${lastDay ? "تا یک روز دیگر" : `${toPersianDigits(account.daysLeft)} روز دیگر`} تمام می‌شود.`,
      action: account.state === "trial" ? "خرید اشتراک" : "تمدید",
      kind: "plans"
    };
  }
  if (account.state === "grace") {
    return { key, tone: "warn", text: `اشتراکت تمام شده؛ ${formatDaysLeft(account.graceDaysLeft)} فرصت تمدید داری.`, action: "تمدید", kind: "plans" };
  }
  return { key, tone: "danger", text: "در جست‌وجو دیده نمی‌شوی و نوبت آنلاین نمی‌گیری.", action: "خرید اشتراک", kind: "plans" };
}

/** «رسید پرداخت فرفرو …», the text the «کپی رسید» button copies. */
export function receiptText(payment) {
  const lines = [
    "رسید پرداخت فرفرو",
    payment.receiptNo ? `شمارهٔ رسید: ${payment.receiptNo}` : "",
    `پلن: ${payment.title}`,
    `مبلغ: ${toPersianDigits(Number(payment.amountToman || 0).toLocaleString("en-US").replace(/,/g, "٬"))} تومان`,
    payment.refId ? `کد پیگیری بانک: ${toPersianDigits(payment.refId)}` : "",
    payment.paidAt ? `تاریخ پرداخت: ${formatPersianLongDate(payment.paidAt)}` : "",
    payment.periodEnd ? `اعتبار تا: ${formatPersianLongDate(payment.periodEnd)}` : ""
  ];
  return lines.filter(Boolean).join("\n");
}
