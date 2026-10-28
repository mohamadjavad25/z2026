"use client";

import { Spinner } from "../../components/Spinner";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui";
import { Mascot } from "../../components/Mascot";
import { toPersianDigits } from "../../shared/lib/digits";
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
export function PaymentResultSheet({ open, paymentId, onClose, onRetry, onRetryPack }) {
  // onRetry reopens the same plans: for the same team artist when the salon was paying for one.
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
      result = { ok: false, payload: { error: "اینترنتت وصل نیست؛ یه نگاه بنداز و دوباره بزن." } };
    }
    if (watching.current !== asked) return;
    if (!result.ok) {
      setError(result.payload?.error || "جواب پرداخت نیومد؛ دوباره بزن.");
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
  const pack = payment?.kind === "sms_pack";
  return (
    <ProfileSheet open={open} kicker={pack ? "پیامک" : "اشتراک"} title="نتیجهٔ پرداخت" label="نتیجهٔ پرداخت اشتراک" panelClassName="billSheet" onClose={onClose}>
      {error && !payment ? (
        <div className="billResult is-bad">
          <span className="billResultIcon"><CircleX size={30} aria-hidden="true" /></span>
          <b>جواب نیومد</b>
          <p role="alert">{error}</p>
          <Button variant="secondary" icon={RefreshCw} onClick={checkAgain}>دوباره چک کن</Button>
        </div>
      ) : null}

      {!error && status === "loading" ? (
        <div className="billResult is-wait" aria-busy="true">
          <span className="billResultIcon"><Spinner size={30} /></span>
          <b>دارم جواب رو می‌گیرم…</b>
        </div>
      ) : null}

      {status === "pending" ? (
        <div className="billResult is-wait" role="status">
          <span className="billResultIcon"><Spinner size={30} /></span>
          <b>{waitedOut ? "بانک هنوز جواب نداده" : "دارم پرداخت رو چک می‌کنم…"}</b>
          <p>
            {waitedOut
              ? `اگه پرداخت رو کامل کردی و پولی کم شده، نگران نباش: همین که بانک تأیید کنه، ${pack ? "بسته‌ت خودش اضافه می‌شه" : "اشتراکت خودش فعال می‌شه"}. اگه نیمه‌کاره ولش کردی، این صفحه رو ببند؛ چیزی از حسابت کم نشده.`
              : "چند ثانیه صبر کن؛ داریم از بانک می‌پرسیم. اگه پرداخت رو کامل نکردی، می‌تونی این صفحه رو ببندی."}
          </p>
          {waitedOut ? <Button variant="secondary" icon={RefreshCw} onClick={checkAgain}>دوباره چک کن</Button> : null}
        </div>
      ) : null}

      {status === "paid" ? (
        <>
          <div className="billResult is-ok" role="status">
            <span className="billResultIcon"><CircleCheck size={30} aria-hidden="true" /></span>
            {pack ? <Mascot pose="done" size={84} className="smsMascot" /> : null}
            <b>{pack ? "پیامک‌هات رسید" : payment.paidFor ? `اشتراک ${payment.paidFor} فعال شد` : "اشتراکت فعال شد"}</b>
            <p>
              {pack
                ? `${toPersianDigits(payment.smsCredits)} پیامک به حسابت اضافه شد و تا مصرف نکنی می‌مونه. رسیدش توی «پرداخت‌هام» هم هست.`
                : `تا ${formatPersianLongDate(payment.periodEnd)}. رسیدش توی «پرداخت‌هام» هم هست.`}
            </p>
          </div>
          <ReceiptDetails payment={payment} />
          <div className="billSheetActions">
            <CopyReceiptButton payment={payment} />
            <Button onClick={onClose}>عالی!</Button>
          </div>
        </>
      ) : null}

      {status === "failed" ? (
        <>
          <div className="billResult is-bad" role="alert">
            <span className="billResultIcon"><CircleX size={30} aria-hidden="true" /></span>
            <b>پرداخت نشد</b>
            <p>{payment.failure || "پرداخت کامل نشد."} اگه پولی از حسابت کم شده، بانک خودش برش می‌گردونه (معمولاً تا ۷۲ ساعت).</p>
          </div>
          <div className="billSheetActions">
            <Button variant="secondary" onClick={onClose}>بستن</Button>
            <Button onClick={() => (pack ? onRetryPack() : onRetry(payment.paidForUserId || null))}>دوباره بزن</Button>
          </div>
        </>
      ) : null}
    </ProfileSheet>
  );
}
