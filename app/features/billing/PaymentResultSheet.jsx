"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, Hourglass, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui";
import { ProfileSheet } from "../profile/ProfileSheet";
import { getBillingPayment } from "../../shared/api/billing";
import { formatPersianLongDate } from "../../shared/lib/billingFormat";
import { CopyReceiptButton, ReceiptDetails } from "./ReceiptDetails";
import { forgetPendingPayment, refreshBilling } from "./billingStore";

const POLL_MS = 3000;
const POLL_LIMIT = 40; // about two minutes

/**
 * The result of one payment, back in the app. A payment still being checked is asked about every few seconds (the
 * server asks the gateway); after about two minutes the page stops asking on its own and offers a button instead.
 */
export function PaymentResultSheet({ open, paymentId, onClose, onRetry }) {
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");
  const [waitedOut, setWaitedOut] = useState(false);
  const tries = useRef(0);
  const timer = useRef(null);
  // The sheet that is open right now; an answer arriving after it closed (or switched payment) is dropped.
  const watching = useRef(0);

  const load = useCallback(async () => {
    clearTimeout(timer.current);
    const asked = paymentId;
    let result;
    try {
      result = await getBillingPayment(asked);
    } catch {
      result = { ok: false, payload: { error: "اتصال برقرار نشد؛ اینترنت را بررسی کن." } };
    }
    if (watching.current !== asked) return;
    if (!result.ok) {
      setError(result.payload?.error || "نتیجهٔ پرداخت دریافت نشد.");
      return;
    }
    setError("");
    const next = result.data.payment;
    setPayment(next);
    if (next.status === "pending") {
      tries.current += 1;
      if (tries.current < POLL_LIMIT) timer.current = setTimeout(load, POLL_MS);
      else setWaitedOut(true);
      return;
    }
    forgetPendingPayment(next.id);
    refreshBilling();
  }, [paymentId]);

  useEffect(() => {
    if (!open || !paymentId) return undefined;
    watching.current = paymentId;
    tries.current = 0;
    setPayment(null);
    setError("");
    setWaitedOut(false);
    load();
    return () => {
      watching.current = 0;
      clearTimeout(timer.current);
    };
  }, [open, paymentId, load]);

  function checkAgain() {
    tries.current = 0;
    setWaitedOut(false);
    load();
  }

  const status = payment?.status || "loading";
  return (
    <ProfileSheet open={open} kicker="اشتراک" title="نتیجهٔ پرداخت" label="نتیجهٔ پرداخت اشتراک" panelClassName="billSheet" onClose={onClose}>
      {error && !payment ? (
        <div className="billResult is-bad">
          <span className="billResultIcon"><CircleX size={30} aria-hidden="true" /></span>
          <b>نتیجه دریافت نشد</b>
          <p role="alert">{error}</p>
          <Button variant="secondary" icon={RefreshCw} onClick={checkAgain}>دوباره بررسی کن</Button>
        </div>
      ) : null}

      {!error && status === "loading" ? (
        <div className="billResult is-wait" aria-busy="true">
          <span className="billResultIcon"><Hourglass size={30} aria-hidden="true" className="billSpinSlow" /></span>
          <b>در حال دریافت نتیجه…</b>
        </div>
      ) : null}

      {status === "pending" ? (
        <div className="billResult is-wait" role="status">
          <span className="billResultIcon"><Hourglass size={30} aria-hidden="true" className="billSpinSlow" /></span>
          <b>{waitedOut ? "نتیجه هنوز از بانک نیامده" : "در حال تأیید پرداخت…"}</b>
          <p>
            {waitedOut
              ? "اگر پرداخت را کامل کردی و پولی کم شده، نگران نباش: به‌محض اینکه بانک تأیید کند، اشتراکت خودکار فعال می‌شود. اگر پرداخت را نیمه‌کاره رها کردی، این صفحه را ببند؛ چیزی از حسابت کم نشده."
              : "چند ثانیه صبر کن؛ نتیجه از بانک پرسیده می‌شود. اگر پرداخت را کامل نکردی، می‌توانی این صفحه را ببندی."}
          </p>
          {waitedOut ? <Button variant="secondary" icon={RefreshCw} onClick={checkAgain}>دوباره بررسی کن</Button> : null}
        </div>
      ) : null}

      {status === "paid" ? (
        <>
          <div className="billResult is-ok" role="status">
            <span className="billResultIcon"><CircleCheck size={30} aria-hidden="true" /></span>
            <b>اشتراکت فعال شد</b>
            <p>تا {formatPersianLongDate(payment.periodEnd)}. رسید در «پرداخت‌های من» هم می‌ماند.</p>
          </div>
          <ReceiptDetails payment={payment} />
          <div className="billSheetActions">
            <CopyReceiptButton payment={payment} />
            <Button onClick={onClose}>عالی، بستن</Button>
          </div>
        </>
      ) : null}

      {status === "failed" ? (
        <>
          <div className="billResult is-bad" role="alert">
            <span className="billResultIcon"><CircleX size={30} aria-hidden="true" /></span>
            <b>پرداخت انجام نشد</b>
            <p>{payment.failure || "پرداخت کامل نشد."} اگر پولی از حسابت کم شده، بانک آن را خودکار برمی‌گرداند (معمولاً تا ۷۲ ساعت).</p>
          </div>
          <div className="billSheetActions">
            <Button variant="secondary" onClick={onClose}>بستن</Button>
            <Button onClick={onRetry}>دوباره امتحان کن</Button>
          </div>
        </>
      ) : null}
    </ProfileSheet>
  );
}
