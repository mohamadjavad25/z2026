"use client";

import { useEffect } from "react";
import { ChevronLeft, FlaskConical, LoaderCircle, ReceiptText } from "lucide-react";
import { Button } from "../../components/ui";
import { toPersianDigits } from "../../shared/lib/digits";
import { accountView } from "./billingView";
import { openPaymentHistory, openPaymentResult, openPlans, refreshBilling, useBilling } from "./billingStore";

/**
 * «اشتراک» at the top of Settings, for salons and artists. Where the account stands in one sentence, how much is
 * left, and the one button. Hidden entirely until billing is switched on (or the account has paid before).
 */
export function SubscriptionCard() {
  const { overview } = useBilling();
  useEffect(() => {
    refreshBilling();
  }, []);
  const view = accountView(overview);
  if (!view) return null;
  const meterPct = view.meter === null ? null : Math.round(view.meter * 100);

  return (
    <section className="spSection" aria-labelledby="spSection-billing">
      <h3 className="spSectionTitle" id="spSection-billing">اشتراک</h3>
      <div className={`billCard is-${view.tone}`}>
        <div className="billCardHead">
          <span className="billBadge">{view.badge}</span>
          {overview.sandbox ? <span className="billBadge is-test"><FlaskConical size={13} aria-hidden="true" /> آزمایشی</span> : null}
        </div>
        <b className="billCardTitle">{view.title}</b>
        <p className="billCardSub">{view.sub}</p>
        {meterPct !== null ? (
          <div className="billMeter" role="progressbar" aria-label="روزهای باقی‌مانده" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meterPct} aria-valuetext={`${toPersianDigits(meterPct)} درصد مانده`}>
            <i style={{ width: `${Math.max(meterPct, 3)}%` }} />
          </div>
        ) : null}
        {view.note ? <p className="billCardNote">{view.note}</p> : null}
        {overview.pending ? (
          <button type="button" className="billPendingRow" onClick={() => openPaymentResult(overview.pending.id)}>
            <LoaderCircle size={16} aria-hidden="true" className="billSpin" />
            <span>یک پرداخت در حال بررسی است</span>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        ) : null}
        <div className="billCardActions">
          <Button variant={view.action.emphasis} disabled={view.action.disabled} onClick={openPlans}>{view.action.label}</Button>
          <button type="button" className="billGhostBtn" onClick={openPaymentHistory}>
            <ReceiptText size={16} aria-hidden="true" /> پرداخت‌های من
          </button>
        </div>
      </div>
    </section>
  );
}
