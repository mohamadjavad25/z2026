"use client";

import { useEffect, useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui";
import { ProfileSheet } from "../profile/ProfileSheet";
import { startBillingCheckout } from "../../shared/api/billing";
import { formatPersianLongDate } from "../../shared/lib/billingFormat";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatToman, formatTomanNumber } from "../../shared/lib/money";
import { LegalLink } from "../../legal/LegalLink";
import { goToGateway, rememberPendingPayment } from "./billingStore";

function leadText(account, name = "") {
  const until = formatPersianLongDate(account?.accessEndsAt);
  if (name) {
    if (account?.state === "trial") return `ماه رایگان ${name} تا ${until} هست. پلنی که الان بخری از همون روز شروع می‌شه.`;
    if (account?.state === "active") return `پلن تازه به آخر اشتراک ${name} (${until}) اضافه می‌شه.`;
    return "پلن از همین امروز شروع می‌شه.";
  }
  if (account?.state === "trial") return `ماه رایگانت تا ${until} هست. پلنی که الان بخری از همون روز شروع می‌شه.`;
  if (account?.state === "active") return `پلن تازه به آخر اشتراکت (${until}) اضافه می‌شه.`;
  return "پلن از همین امروز شروع می‌شه.";
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
      result = { ok: false, payload: { error: "اینترنتت وصل نیست؛ یه نگاه بنداز و دوباره بزن." } };
    }
    if (!result.ok || !result.data?.redirect) {
      setError(result.payload?.error || "نرفتیم سراغ بانک؛ دوباره بزن.");
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
      title={forMember ? `پرداخت برای ${forMember.name}` : "یه پلن انتخاب کن"}
      label={forMember ? `پرداخت اشتراک ${forMember.name}` : "انتخاب پلن اشتراک"}
      panelClassName="billSheet"
      onClose={busy ? () => {} : onClose}
    >
      <p className="billSheetLead">{forMember ? leadText(forMember.account, forMember.name) : leadText(overview?.account)}</p>
      {forMember ? <p className="billTeamNote">اشتراک {forMember.name} تمدید می‌شه و رسیدش پیش تو می‌مونه. پرداخت برای آرتیست‌ها دلبخواهیه.</p> : null}

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
        <p className="billTestNote"><FlaskConical size={16} aria-hidden="true" /> درگاه آزمایشیه؛ پولی کم نمی‌شه.</p>
      ) : null}
      {error ? <p className="billError" role="alert">{error}</p> : null}

      <Button block icon={ShieldCheck} loading={busy} loadingLabel="داریم می‌ریم صفحهٔ بانک…" disabled={!plan || !ready} onClick={pay}>
        {ready && plan ? `پرداخت ${formatTomanNumber(plan.amountToman)} تومان` : "پرداخت به‌زودی باز می‌شه"}
      </Button>

      <p className="billFine">
        پرداخت توی صفحهٔ امن بانکه و فرفرو شمارهٔ کارتت رو نمی‌بینه. تمدید خودکار نداریم؛ بی‌اجازه‌ت پولی کم نمی‌شه.
        با پرداخت، <LegalLink doc="terms">قوانین و مقررات</LegalLink> رو قبول داری.
      </p>
    </ProfileSheet>
  );
}
