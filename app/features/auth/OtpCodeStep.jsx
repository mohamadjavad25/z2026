"use client";

import { useEffect, useState } from "react";
import { Button, Field } from "../../components/ui";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { sendCode, useCountdown } from "./otp";

/**
 * "Enter the 5-digit code we texted you" -- shared by sign-up and password reset.
 * Sends the first code on mount, offers a resend after the countdown, and hands the typed code to `onSubmit(code)`.
 * `onSubmit` returns an error message (string) to show, or nothing on success.
 */
export function OtpCodeStep({ phone, purpose, resendSeconds = 60, submitLabel, busy = false, onSubmit, onEditPhone, children }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(true);
  const countdown = useCountdown(resendSeconds);

  async function send() {
    setSending(true);
    setError("");
    const { ok, payload } = await sendCode(phone, purpose);
    setSending(false);
    if (ok) countdown.restart();
    else setError(payload.error || "ارسال پیامک انجام نشد.");
  }

  useEffect(() => {
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send the first code once, when the step opens
  }, []);

  async function submit(event) {
    event.preventDefault();
    const clean = toLatinDigits(code).trim();
    if (!/^\d{5}$/.test(clean)) {
      setError("کد ۵رقمی را کامل وارد کن.");
      return;
    }
    setError("");
    const message = await onSubmit(clean);
    if (message) setError(message);
  }

  return (
    <div className="authOtp" role="group" aria-label="تأیید شماره با پیامک">
      <p className="authOtpText">
        کد ۵رقمی پیامک‌شده به <b dir="ltr">{toPersianDigits(phone)}</b> را وارد کن.
      </p>
      <Field label="کد تأیید" error={error} hideLabel>
        {(props) => (
          <input
            {...props}
            name="otpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={5}
            placeholder="_ _ _ _ _"
            value={code}
            onChange={(event) => { setCode(toLatinDigits(event.target.value).replace(/\D/g, "")); setError(""); }}
            onKeyDown={(event) => { if (event.key === "Enter") submit(event); }}
            autoFocus
          />
        )}
      </Field>
      {children}
      <Button block loading={busy} loadingLabel="در حال بررسی…" onClick={submit}>{submitLabel}</Button>
      <div className="authOtpActions">
        <button type="button" disabled={sending || countdown.left > 0} onClick={send}>
          {sending ? "در حال ارسال…" : countdown.left > 0 ? `ارسال دوباره (${toPersianDigits(countdown.left)})` : "ارسال دوبارهٔ کد"}
        </button>
        {onEditPhone ? <button type="button" onClick={onEditPhone}>ویرایش شماره</button> : null}
      </div>
    </div>
  );
}
