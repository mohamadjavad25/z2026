"use client";

import { useEffect, useState } from "react";
import { Button, Field } from "../../components/ui";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { sendCode, useCountdown } from "./otp";

/**
 * "Enter the 5-digit code we texted you" -- shared by sign-up and password reset.
 * Sends the first code on mount, offers a resend after the countdown, and hands the typed code to `onSubmit(code)`.
 * `onSubmit` returns an error message (string) to show, or nothing on success. `sendExtra` rides along on each send.
 * `onPhoneTaken`: sign-up found the number already has an account (the form then opens the login instead).
 */
export function OtpCodeStep({ phone, purpose, sendExtra, resendSeconds = 60, submitLabel, busy = false, onSubmit, onEditPhone, onPhoneTaken = null, editLabel = "شماره رو عوض کن", children }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(true);
  const countdown = useCountdown(resendSeconds);

  async function send() {
    setSending(true);
    setError("");
    const { ok, payload } = await sendCode(phone, purpose, sendExtra);
    setSending(false);
    if (!ok && payload?.code === "phone_taken" && onPhoneTaken) { onPhoneTaken(); return; }
    if (ok) countdown.restart();
    else setError(payload.error || "پیامک نرفت؛ دوباره بزن.");
  }

  useEffect(() => {
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send the first code once, when the step opens
  }, []);

  async function submit(event) {
    event.preventDefault();
    const clean = toLatinDigits(code).trim();
    if (!/^\d{5}$/.test(clean)) {
      setError("هر ۵ رقم کد رو بزن.");
      return;
    }
    setError("");
    const message = await onSubmit(clean);
    if (message) setError(message);
  }

  return (
    <div className="authOtp" role="group" aria-label="تأیید شماره با پیامک">
      <p className="authOtpText">
        کد ۵رقمی‌ای که به <b dir="ltr">{toPersianDigits(phone)}</b> پیامک شد رو بزن.
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
      <Button block loading={busy} loadingLabel="دارم چک می‌کنم…" onClick={submit}>{submitLabel}</Button>
      <div className="authOtpActions">
        <button type="button" disabled={sending || countdown.left > 0} onClick={send}>
          {sending ? "دارم می‌فرستم…" : countdown.left > 0 ? `دوباره بفرست (${toPersianDigits(countdown.left)})` : "کد رو دوباره بفرست"}
        </button>
        {onEditPhone ? <button type="button" onClick={onEditPhone}>{editLabel}</button> : null}
      </div>
    </div>
  );
}
