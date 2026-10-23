"use client";

import { SkeletonList } from "../../components/Skeleton";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { listBillingPayments } from "../../shared/api/billing";
import { formatPersianLongDate } from "../../shared/lib/billingFormat";
import { formatToman } from "../../shared/lib/money";
import { CopyReceiptButton, PaymentStatusChip, ReceiptDetails, chipStatus } from "./ReceiptDetails";

/** «پرداخت‌های من»: every payment, newest first; one tap opens its full receipt. */
export function PaymentsSheet({ open, onClose }) {
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setSelected(null);
    setError("");
    listBillingPayments()
      .then((result) => {
        if (!live) return;
        if (result.ok) setPayments(result.data.payments || []);
        else setError(result.payload?.error || "پرداخت‌ها نیومد؛ دوباره بزن.");
      })
      .catch(() => live && setError("اینترنتت وصل نیست؛ یه نگاه بنداز و دوباره بزن."));
    return () => {
      live = false;
    };
  }, [open]);

  return (
    <ProfileSheet
      open={open}
      kicker="اشتراک"
      title={selected ? "رسید" : "پرداخت‌هام"}
      label="پرداخت‌هام"
      panelClassName="billSheet"
      onClose={selected ? () => setSelected(null) : onClose}
    >
      {selected ? (
        <>
          <button type="button" className="billBackLink" onClick={() => setSelected(null)}>
            <ChevronRight size={16} aria-hidden="true" /> همهٔ پرداخت‌ها
          </button>
          <ReceiptDetails payment={selected} />
          {selected.status === "paid" ? <div className="billSheetActions"><CopyReceiptButton payment={selected} /></div> : null}
        </>
      ) : (
        <>
          {error ? <p className="billError" role="alert">{error}</p> : null}
          {!payments && !error ? <SkeletonList rows={3} variant="row" label="دارم پرداخت‌ها رو میارم" /> : null}
          {payments && !payments.length ? (
            <div className="billEmpty">
              <ReceiptText size={26} aria-hidden="true" />
              <b>هنوز پرداختی نداری</b>
              <p>رسید هر پرداختت اینجا می‌مونه.</p>
            </div>
          ) : null}
          {payments?.length ? (
            <ul className="billHistory">
              {payments.map((payment) => (
                <li key={payment.id}>
                  <button type="button" onClick={() => setSelected(payment)}>
                    <span className="billHistoryMain">
                      <b>{payment.title}</b>
                      <small>
                        {payment.paidFor ? `برای ${payment.paidFor}، ` : payment.paidBy ? `پرداخت ${payment.paidBy}، ` : ""}
                        {formatPersianLongDate(payment.paidAt || payment.createdAt)}{payment.sandbox ? "، آزمایشی" : ""}
                      </small>
                    </span>
                    <span className="billHistorySide">
                      <b>{payment.amountToman ? formatToman(payment.amountToman) : "هدیه"}</b>
                      <PaymentStatusChip status={chipStatus(payment)} />
                    </span>
                    <ChevronLeft size={16} aria-hidden="true" className="billHistoryChevron" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </ProfileSheet>
  );
}
