"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatPersianDateTime, formatPersianLongDate } from "../../shared/lib/billingFormat";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatToman } from "../../shared/lib/money";
import { receiptText } from "./billingView";

export const PAYMENT_STATUS = {
  paid: { label: "پرداخت‌شده", tone: "ok" },
  pending: { label: "در حال بررسی", tone: "wait" },
  failed: { label: "ناموفق", tone: "bad" }
};

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
      {state === "done" ? "کپی شد" : state === "failed" ? "کپی نشد؛ از صفحه عکس بگیر" : "کپی رسید"}
    </button>
  );
}

/** Every line of one payment, as on a paper receipt. */
export function ReceiptDetails({ payment }) {
  const rows = [
    ["شمارهٔ رسید", payment.receiptNo ? <span dir="ltr">{payment.receiptNo}</span> : "—"],
    ["وضعیت", <PaymentStatusChip key="status" status={payment.status} />],
    ["پلن", payment.title],
    ["مبلغ", payment.amountToman ? formatToman(payment.amountToman) : "رایگان (هدیه)"],
    payment.refId ? ["کد پیگیری بانک", <span key="ref" dir="ltr">{toPersianDigits(payment.refId)}</span>] : null,
    payment.cardPan ? ["کارت", <span key="pan" dir="ltr">{toPersianDigits(payment.cardPan)}</span>] : null,
    ["تاریخ", formatPersianDateTime(payment.paidAt || payment.createdAt)],
    payment.periodStart && payment.periodEnd ? ["اعتبار", `${formatPersianLongDate(payment.periodStart)} تا ${formatPersianLongDate(payment.periodEnd)}`] : null,
    ["روش", payment.source === "admin" ? "ثبت‌شده توسط فرفرو" : payment.gatewayLabel],
    payment.status === "failed" && payment.failure ? ["دلیل", payment.failure] : null
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
