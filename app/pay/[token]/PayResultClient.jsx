"use client";

import { Spinner } from "../../components/Spinner";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, FlaskConical } from "lucide-react";
import { applyRole } from "../../shared/lib/theme";
import { formatPersianLongDate } from "../../shared/lib/billingFormat";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatToman } from "../../shared/lib/money";

const POLL_MS = 3000;
const POLL_LIMIT = 40;

/** The result after the bank, outside the app shell: what happened, the receipt numbers, and the way back. */
export function PayResultClient({ token }) {
  const [payment, setPayment] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing | offline
  const tries = useRef(0);

  useEffect(() => {
    applyRole("salon");
    let live = true;
    let timer = null;
    async function load() {
      try {
        const response = await fetch(`/api/billing/return/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!live) return;
        if (response.status === 404) {
          setState("missing");
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.data?.payment) {
          setState("offline");
          return;
        }
        const next = payload.data.payment;
        setPayment(next);
        setState("ready");
        if (next.status === "pending" && tries.current < POLL_LIMIT) {
          tries.current += 1;
          timer = setTimeout(load, POLL_MS);
        }
      } catch {
        if (live) setState("offline");
      }
    }
    load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token]);

  const back = payment ? `/?billing=${payment.id}` : "/";
  const status = state === "ready" ? payment.status : state;

  return (
    <main className="payPage">
      <section className={`payCard is-${status}`} aria-live="polite">
        <span className="payMark">frfro</span>

        {status === "loading" || status === "pending" ? (
          <>
            <span className="payIcon"><Spinner size={34} /></span>
            <h1>در حال تأیید پرداخت…</h1>
            <p>چند ثانیه صبر کن؛ نتیجه از بانک پرسیده می‌شود. این صفحه خودش به‌روز می‌شود.</p>
          </>
        ) : null}

        {status === "paid" ? (
          <>
            <span className="payIcon"><CircleCheck size={34} aria-hidden="true" /></span>
            <h1>پرداخت موفق بود</h1>
            <p>{payment.title}، تا <b>{formatPersianLongDate(payment.periodEnd)}</b> فعال شد.</p>
            <dl className="payFacts">
              <div><dt>مبلغ</dt><dd>{formatToman(payment.amountToman)}</dd></div>
              <div><dt>شمارهٔ رسید</dt><dd dir="ltr">{payment.receiptNo}</dd></div>
              {payment.refId ? <div><dt>کد پیگیری بانک</dt><dd dir="ltr">{toPersianDigits(payment.refId)}</dd></div> : null}
            </dl>
          </>
        ) : null}

        {status === "failed" ? (
          <>
            <span className="payIcon"><CircleX size={34} aria-hidden="true" /></span>
            <h1>پرداخت انجام نشد</h1>
            <p>{payment.failure || "پرداخت کامل نشد."} اگر پولی از حسابت کم شده، بانک آن را خودکار برمی‌گرداند (معمولاً تا ۷۲ ساعت).</p>
          </>
        ) : null}

        {status === "missing" ? (
          <>
            <span className="payIcon"><CircleX size={34} aria-hidden="true" /></span>
            <h1>این پرداخت پیدا نشد</h1>
            <p>نشانی کامل نیست یا منقضی شده. وضعیت اشتراکت را در اپ ببین: تنظیمات، اشتراک.</p>
          </>
        ) : null}

        {status === "offline" ? (
          <>
            <span className="payIcon"><CircleX size={34} aria-hidden="true" /></span>
            <h1>نتیجه دریافت نشد</h1>
            <p>اتصال برقرار نشد. اینترنت را بررسی کن و صفحه را دوباره باز کن؛ پرداختت ثبت شده و از بین نمی‌رود.</p>
          </>
        ) : null}

        {payment?.sandbox ? <p className="payTest"><FlaskConical size={15} aria-hidden="true" /> پرداخت آزمایشی؛ پولی جابه‌جا نشده است.</p> : null}

        {status !== "loading" && status !== "pending" ? (
          <>
            <a className="payAction" href={back}>بازگشت به فرفرو</a>
            <p className="payHint">اگر از داخل اپ فرفرو پرداخت کردی، به اپ برگرد؛ نتیجه و رسید آنجا هم هست.</p>
          </>
        ) : null}
      </section>
    </main>
  );
}
