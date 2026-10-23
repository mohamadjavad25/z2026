"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatPersianDateTime, formatPersianLongDate } from "../../shared/lib/billingFormat";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatToman } from "../../shared/lib/money";
import { receiptText } from "./billingView";

export const PAYMENT_STATUS = {
  paid: { label: "پرداخت‌شده", tone: "ok" },
  pending: { label: "داره چک می‌شه", tone: "wait" },
  failed: { label: "ناموفق", tone: "bad" },
  refunded: { label: "بازپرداخت‌شده", tone: "wait" }
};

/** A paid payment with a refund recorded on it reads «بازپرداخت‌شده». */
export const chipStatus = (payment) => (payment?.refundedAt ? "refunded" : payment?.status);

export function PaymentStatusChip({ status }) {
  const meta = PAYMENT_STATUS[status] || PAYMENT_STATUS.pending;
  return <span className={`billChip is-${meta.tone}`}>{meta.label}</span>;
}

/** Copies the receipt as text. Falls back to a message when the browser refuses the clipboard. */
export function CopyReceiptButton({ payment }) {
  const [state, setState] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(receiptText(payment));
      setState("done");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState(""), 2200);
  }
  return (
    <button type="button" className="billGhostBtn" onClick={copy}>
      {state === "done" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {state === "done" ? "کپی شد" : state === "failed" ? "کپی نشد؛ از صفحه عکس بگیر" : "رسید رو کپی کن"}
    </button>
  );
}

/** Every line of one payment, as on a paper receipt. */
export function ReceiptDetails({ payment }) {
  const rows = [
    ["شمارهٔ رسید", payment.receiptNo ? <span dir="ltr">{payment.receiptNo}</span> : "—"],
    ["وضعیت", <PaymentStatusChip key="status" status={chipStatus(payment)} />],
    ["پلن", payment.title],
    payment.paidFor ? ["برای", payment.paidFor] : null,
    payment.paidBy ? ["پرداخت کرده", payment.paidBy] : null,
    ["مبلغ", payment.amountToman ? formatToman(payment.amountToman) : "رایگان (هدیه)"],
    payment.refId ? ["کد پیگیری بانک", <span key="ref" dir="ltr">{toPersianDigits(payment.refId)}</span>] : null,
    payment.cardPan ? ["کارت", <span key="pan" dir="ltr">{toPersianDigits(payment.cardPan)}</span>] : null,
    ["تاریخ", formatPersianDateTime(payment.paidAt || payment.createdAt)],
    payment.periodStart && payment.periodEnd ? ["اعتبار", `${formatPersianLongDate(payment.periodStart)} تا ${formatPersianLongDate(payment.periodEnd)}`] : null,
    ["روش", payment.source === "admin" ? "فرفرو ثبت کرده" : payment.gatewayLabel],
    payment.status === "failed" && payment.failure ? ["دلیل", payment.failure] : null,
    payment.refundedAt
      ? ["بازپرداخت", `${formatToman(payment.refundToman)} در ${formatPersianLongDate(payment.refundedAt)}${payment.refundDays ? `، ${toPersianDigits(payment.refundDays)} روز از اشتراک کم شد` : ""}`]
      : null
  ].filter(Boolean);
  return (
    <dl className="billReceipt">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
