import { formatDaysLeft, formatPersianLongDate } from "../../shared/lib/billingFormat.js";
import { toPersianDigits } from "../../shared/lib/digits.js";

/**
 * What the subscription card (Settings) and the reminder bar (home) say, from GET /api/billing. Pure, so every state
 * is unit-tested (tests/unit/billingView.test.js).
 *
 * tone: trial | active | warn | danger | soon. While billing is on but no gateway can take a payment yet
 * ("not enforced"), nothing is closed, so an ended free month reads calm ("soon"), never alarming.
 */
const TRIAL_DAYS_FALLBACK = 30;

export function accountView(overview) {
  if (!overview?.visible || !overview.account) return null;
  const account = overview.account;
  const until = formatPersianLongDate(account.accessEndsAt);
  const ready = Boolean(overview.checkoutReady);
  const cta = (label, emphasis = "primary") => ({ label: ready ? label : "پرداخت به‌زودی باز می‌شه", emphasis, disabled: !ready });

  if (account.state === "trial") {
    return {
      tone: "trial",
      badge: "ماه رایگان",
      title: `${formatDaysLeft(account.daysLeft)} از ماه رایگانت مونده`,
      sub: `تا ${until}. هر پلنی بخری از همون روز شروع می‌شه و روزی از ماه رایگانت نمی‌سوزه.`,
      note: "",
      meter: Math.min(1, Math.max(0, account.daysLeft / (overview.trialDays || TRIAL_DAYS_FALLBACK))),
      action: cta("اشتراک بخر", account.daysLeft <= 5 ? "primary" : "secondary")
    };
  }
  if (account.state === "active") {
    // The meter runs from the last payment to the end of access (which can include free days left when it was bought).
    const paidAt = overview.lastPayment?.paidAt ? new Date(overview.lastPayment.paidAt).getTime() : 0;
    const total = paidAt ? Math.max(account.daysLeft, Math.ceil((new Date(account.accessEndsAt).getTime() - paidAt) / 86_400_000)) : 0;
    return {
      tone: "active",
      badge: "فعال",
      title: `اشتراکت تا ${until} فعاله`,
      sub: `${formatDaysLeft(account.daysLeft)} مونده.${overview.lastPayment?.title ? ` آخرین پرداخت: ${overview.lastPayment.title}.` : ""}`,
      note: "",
      meter: total ? Math.min(1, Math.max(0, account.daysLeft / total)) : null,
      action: cta("تمدیدش کن", account.daysLeft <= 5 ? "primary" : "secondary")
    };
  }
  if (!overview.enforced) {
    return {
      tone: "soon",
      badge: "ماه رایگان تموم شد",
      title: "پرداخت اشتراک به‌زودی باز می‌شه",
      sub: "تا اون موقع همه‌چی مثل قبل کار می‌کنه و چیزی بسته نمی‌شه.",
      note: "",
      meter: null,
      action: cta("اشتراک بخر")
    };
  }
  if (account.state === "grace") {
    return {
      tone: "warn",
      badge: "مهلت تمدید",
      title: "اشتراکت تموم شده",
      sub: `${formatDaysLeft(account.graceDaysLeft)} وقت داری تمدید کنی. بعدش توی جستجو دیده نمی‌شی و نوبت آنلاین نمی‌گیری.`,
      note: "",
      meter: null,
      action: cta("تمدیدش کن")
    };
  }
  return {
    tone: "danger",
    badge: "غیرفعال",
    title: "اشتراکت غیرفعاله",
    sub: "توی جستجو دیده نمی‌شی و نوبت آنلاین نمی‌گیری. نوبت‌ها، مشتری‌ها و عکس‌هات سر جاشونه و اشتراک بخری همون لحظه همه‌چی برمی‌گرده.",
    note: "",
    meter: null,
    action: cta("اشتراک بخر")
  };
}

/**
 * The bar on the home page: only when something needs the owner's attention (a payment being checked, five days or
 * fewer left, grace, closed). `key` changes when the situation changes, so a closed bar comes back for the next step.
 */
export function bannerView(overview) {
  if (!overview?.visible || !overview.account) return null;
  if (overview.pending) {
    return { key: `pending-${overview.pending.id}`, tone: "info", text: "پرداختت داره چک می‌شه.", action: "ببین چی شد", kind: "result", paymentId: overview.pending.id };
  }
  const account = overview.account;
  // Nothing to warn about while nobody can pay yet.
  if (!overview.enforced) return null;
  const key = `${account.state}-${account.accessEndsAt}`;
  if (account.state === "trial" || account.state === "active") {
    if (account.daysLeft > 5) return null;
    const lastDay = account.daysLeft <= 1;
    return {
      key: `${key}-${lastDay ? "1" : "5"}`,
      tone: lastDay ? "warn" : "info",
      text: account.state === "trial"
        ? `${formatDaysLeft(account.daysLeft)} از ماه رایگانت مونده.`
        : `اشتراکت ${lastDay ? "تا یه روز دیگه" : `${toPersianDigits(account.daysLeft)} روز دیگه`} تموم می‌شه.`,
      action: account.state === "trial" ? "اشتراک بخر" : "تمدید",
      kind: "plans"
    };
  }
  if (account.state === "grace") {
    return { key, tone: "warn", text: `اشتراکت تموم شده؛ ${formatDaysLeft(account.graceDaysLeft)} وقت داری تمدید کنی.`, action: "تمدید", kind: "plans" };
  }
  return { key, tone: "danger", text: "توی جستجو دیده نمی‌شی و نوبت آنلاین نمی‌گیری.", action: "اشتراک بخر", kind: "plans" };
}

/**
 * One artist in the salon's «اشتراک آرتیست‌های تیم» list: a short status line and its tone. Paying for them is the
 * salon's choice; an artist the salon does not pay for pays for themselves.
 */
export function teamMemberView(member, overview) {
  const account = member?.account || {};
  if (account.state === "trial") return { tone: "trial", status: `ماه رایگان، ${formatDaysLeft(account.daysLeft)} مونده`, urgent: account.daysLeft <= 5 };
  if (account.state === "active") return { tone: "active", status: `فعال تا ${formatPersianLongDate(account.accessEndsAt)}`, urgent: account.daysLeft <= 5 };
  if (!overview?.enforced) return { tone: "soon", status: "ماه رایگان تموم شد", urgent: false };
  if (account.state === "grace") return { tone: "warn", status: `تموم شده، ${formatDaysLeft(account.graceDaysLeft)} مهلت`, urgent: true };
  return { tone: "danger", status: "غیرفعال؛ توی جستجو دیده نمی‌شه", urgent: true };
}

/** «رسید پرداخت فرفرو …», the text the «کپی رسید» button copies. */
export function receiptText(payment) {
  const lines = [
    "رسید پرداخت فرفرو",
    payment.receiptNo ? `شمارهٔ رسید: ${payment.receiptNo}` : "",
    `پلن: ${payment.title}`,
    payment.paidFor ? `برای: ${payment.paidFor}` : "",
    payment.paidBy ? `پرداخت توسط: ${payment.paidBy}` : "",
    `مبلغ: ${toPersianDigits(Number(payment.amountToman || 0).toLocaleString("en-US").replace(/,/g, "٬"))} تومان`,
    payment.refId ? `کد پیگیری بانک: ${toPersianDigits(payment.refId)}` : "",
    payment.paidAt ? `تاریخ پرداخت: ${formatPersianLongDate(payment.paidAt)}` : "",
    payment.periodEnd ? `اعتبار تا: ${formatPersianLongDate(payment.periodEnd)}` : ""
  ];
  return lines.filter(Boolean).join("\n");
}
