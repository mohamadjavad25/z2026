"use client";

import { useEffect, useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui";
import { ProfileSheet } from "../profile/ProfileSheet";
import { startSmsPackCheckout } from "../../shared/api/billing";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatToman, formatTomanNumber } from "../../shared/lib/money";
import { LegalLink } from "../../legal/LegalLink";
import { goToGateway, rememberPendingPayment } from "./billingStore";

/**
 * Buying an SMS pack: pick one, see what the wallet will hold, go to the bank. The amount is decided on the server by the
 * pack's id; nothing here sets a price. Packs never expire and are used after the month's 200.
 */
export function SmsPackSheet({ open, overview, onClose }) {
  const sms = overview?.sms || null;
  const packs = sms?.packs || [];
  const [selected, setSelected] = useState(packs[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected(packs[0]?.id || "");
    setBusy(false);
    setError("");
    // packs is a new array on every refresh; the first pack's id is what decides the preselection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, packs[0]?.id]);

  // Back from the bank with the browser's back button: the page comes from cache with the button still spinning.
  useEffect(() => {
    const reset = (event) => event.persisted && setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const pack = packs.find((item) => item.id === selected) || null;
  const ready = Boolean(overview?.checkoutReady);

  async function pay() {
    if (!pack || busy) return;
    setBusy(true);
    setError("");
    let result;
    try {
      result = await startSmsPackCheckout(pack.id);
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
      kicker="پیامک"
      title="یه بسته انتخاب کن"
      label="انتخاب بسته‌ی پیامک"
      panelClassName="billSheet"
      onClose={busy ? () => {} : onClose}
    >
      <p className="billSheetLead">
        هر پیامکی که برای مشتری‌هات می‌ره، یکی از این پیامک‌ها کم می‌کنه. اول ۲۰۰ تای ماهانه‌ت مصرف می‌شه، بعد بسته‌ها. بسته تموم نشده می‌مونه.
      </p>

      <fieldset className="billPlans" disabled={busy}>
        <legend className="srOnly">بسته‌ی پیامک</legend>
        {packs.map((item) => (
          <label key={item.id} className={`billPlan${item.id === selected ? " is-selected" : ""}`}>
            <input type="radio" name="smsPack" value={item.id} checked={item.id === selected} onChange={() => setSelected(item.id)} />
            <span className="billPlanDot" aria-hidden="true" />
            <span className="billPlanMain">
              <b>{toPersianDigits(item.credits)} پیامک</b>
              <small>هر پیامک حدود {toPersianDigits(Math.round(item.amountToman / item.credits))} تومان</small>
            </span>
            <span className="billPlanPrice">
              <b>{formatTomanNumber(item.amountToman)}<small> تومان</small></b>
            </span>
          </label>
        ))}
      </fieldset>

      {pack ? (
        <dl className="billSummary" aria-live="polite">
          <div><dt>الان داری</dt><dd>{toPersianDigits(sms?.left || 0)} پیامک</dd></div>
          <div><dt>بعد از خرید</dt><dd>{toPersianDigits((sms?.left || 0) + pack.credits)} پیامک</dd></div>
          <div className="is-total"><dt>قابل پرداخت</dt><dd>{formatToman(pack.amountToman)}</dd></div>
        </dl>
      ) : null}

      {overview?.sandbox ? (
        <p className="billTestNote"><FlaskConical size={16} aria-hidden="true" /> درگاه آزمایشیه؛ پولی کم نمی‌شه.</p>
      ) : null}
      {error ? <p className="billError" role="alert">{error}</p> : null}

      <Button block icon={ShieldCheck} loading={busy} loadingLabel="داریم می‌ریم صفحهٔ بانک…" disabled={!pack || !ready} onClick={pay}>
        {ready && pack ? `پرداخت ${formatTomanNumber(pack.amountToman)} تومان` : "پرداخت به‌زودی باز می‌شه"}
      </Button>

      <p className="billFine">
        پرداخت توی صفحهٔ امن بانکه و فرفرو شمارهٔ کارتت رو نمی‌بینه. بی‌اجازه‌ت پولی کم نمی‌شه.
        تا هفت روز کاری، اگه هنوز از بسته مصرف نکرده باشی، پولت برمی‌گرده. با پرداخت، <LegalLink doc="terms">قوانین و مقررات</LegalLink> رو قبول داری.
      </p>
    </ProfileSheet>
  );
}
