"use client";

import { useEffect, useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui";
import { ProfileSheet } from "../profile/ProfileSheet";
import { startBillingCheckout } from "../../shared/api/billing";
import { formatPersianLongDate } from "../../shared/lib/billingFormat";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatToman, formatTomanNumber } from "../../shared/lib/money";
import { goToGateway, rememberPendingPayment } from "./billingStore";

function leadText(account, name = "") {
  const until = formatPersianLongDate(account?.accessEndsAt);
  if (name) {
    if (account?.state === "trial") return `ماه رایگان ${name} تا ${until} ادامه دارد. پلنی که الان بخری از همان روز شروع می‌شود.`;
    if (account?.state === "active") return `پلن تازه به آخر اشتراک فعلی ${name} (${until}) اضافه می‌شود.`;
    return "پلن از همین امروز شروع می‌شود.";
  }
  if (account?.state === "trial") return `ماه رایگانت تا ${until} ادامه دارد. پلنی که الان بخری از همان روز شروع می‌شود.`;
  if (account?.state === "active") return `پلن تازه به آخر اشتراک فعلی‌ات (${until}) اضافه می‌شود.`;
  return "پلن از همین امروز شروع می‌شود.";
}

/**
 * Three plans, one button, straight to the bank. The middle plan is picked first; the summary under the plans shows
 * exactly which dates the chosen plan covers and what is charged. The amount is decided on the server, never here.
 * forMember: a salon paying for an artist on its team (the artist's plans, dates and name instead of the salon's).
 */
export function PlanSheet({ open, overview, forMember = null, onClose }) {
  const plans = (forMember ? forMember.plans : overview?.plans) || [];
  const preselected = (plans.find((plan) => plan.preselected) || plans[0])?.id || "";
  const [selected, setSelected] = useState(preselected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected(preselected);
    setBusy(false);
    setError("");
  }, [open, preselected]);

  // Back from the bank with the browser's back button: the page comes from cache with the button still spinning.
  useEffect(() => {
    const reset = (event) => event.persisted && setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const plan = plans.find((item) => item.id === selected) || null;
  const ready = Boolean(overview?.checkoutReady);
  const roleLabel = forMember || overview?.role === "artist" ? "آرتیست" : "سالن";

  async function pay() {
    if (!plan || busy) return;
    setBusy(true);
    setError("");
    let result;
    try {
      result = await startBillingCheckout(plan.id, forMember?.id || null);
    } catch {
      result = { ok: false, payload: { error: "اتصال برقرار نشد؛ اینترنت را بررسی کن و دوباره بزن." } };
    }
    if (!result.ok || !result.data?.redirect) {
      setError(result.payload?.error || "شروع پرداخت انجام نشد؛ دوباره امتحان کن.");
      setBusy(false);
      return;
    }
    rememberPendingPayment(result.data.paymentId);
    goToGateway(result.data.redirect);
    // The page is leaving for the bank: the button keeps spinning until it does.
  }

  return (
    <ProfileSheet
      open={open}
      kicker={`اشتراک ${roleLabel}`}
      title={forMember ? `پرداخت برای ${forMember.name}` : "انتخاب پلن"}
      label={forMember ? `پرداخت اشتراک ${forMember.name}` : "انتخاب پلن اشتراک"}
      panelClassName="billSheet"
      onClose={busy ? () => {} : onClose}
    >
      <p className="billSheetLead">{forMember ? leadText(forMember.account, forMember.name) : leadText(overview?.account)}</p>
      {forMember ? <p className="billTeamNote">اشتراک {forMember.name} تمدید می‌شود و رسید پیش تو می‌ماند. پرداخت برای آرتیست‌ها اختیاری است.</p> : null}

      <fieldset className="billPlans" disabled={busy}>
        <legend className="srOnly">پلن اشتراک</legend>
        {plans.map((item) => (
          <label key={item.id} className={`billPlan${item.id === selected ? " is-selected" : ""}`}>
            <input type="radio" name="billPlan" value={item.id} checked={item.id === selected} onChange={() => setSelected(item.id)} />
            <span className="billPlanDot" aria-hidden="true" />
            <span className="billPlanMain">
              <b>{item.label}{item.best ? <em className="billPlanFlag">به‌صرفه‌ترین</em> : null}</b>
              <small>
                {toPersianDigits(item.days)} روز
                {item.giftMonths ? <span className="billGift">{toPersianDigits(item.giftMonths)} ماه هدیه</span> : null}
              </small>
            </span>
            <span className="billPlanPrice">
              <b>{formatTomanNumber(item.amountToman)}<small> تومان</small></b>
              <small>{item.months > 1 ? `ماهی ${item.monthlyApprox ? "حدود " : ""}${formatTomanNumber(item.monthlyToman)}` : "ماهانه"}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {plan ? (
        <dl className="billSummary" aria-live="polite">
          <div><dt>از</dt><dd>{formatPersianLongDate(plan.startsAt)}</dd></div>
          <div><dt>تا</dt><dd>{formatPersianLongDate(plan.endsAt)}</dd></div>
          {plan.savingToman ? <div><dt>صرفه‌جویی</dt><dd className="is-gain">{formatToman(plan.savingToman)}</dd></div> : null}
          <div className="is-total"><dt>قابل پرداخت</dt><dd>{formatToman(plan.amountToman)}</dd></div>
        </dl>
      ) : null}

      {overview?.sandbox ? (
        <p className="billTestNote"><FlaskConical size={16} aria-hidden="true" /> درگاه آزمایشی است؛ هیچ پولی گرفته نمی‌شود.</p>
      ) : null}
      {error ? <p className="billError" role="alert">{error}</p> : null}

      <Button block icon={ShieldCheck} loading={busy} loadingLabel="در حال رفتن به درگاه بانک…" disabled={!plan || !ready} onClick={pay}>
        {ready && plan ? `پرداخت ${formatTomanNumber(plan.amountToman)} تومان` : "پرداخت به‌زودی فعال می‌شود"}
      </Button>

      <p className="billFine">
        پرداخت در صفحهٔ امن بانک انجام می‌شود و فرفرو شمارهٔ کارتت را نمی‌بیند. تمدید خودکار نیست؛ هیچ مبلغی بدون اجازه‌ات کم نمی‌شود.
        با پرداخت، <a href="/terms" target="_blank" rel="noreferrer">قوانین و مقررات</a> را می‌پذیری.
      </p>
    </ProfileSheet>
  );
}
