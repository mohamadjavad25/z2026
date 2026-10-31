"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Button, Field } from "../../components/ui";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { LegalLink } from "../../legal/LegalLink";
import { sendCode, verifyCode } from "./otp";
import { clearSignupDraft, readSignupDraft, saveSignupDraft } from "./signupDraft";

export const PHONE_ERROR = "شماره درست نیست؛ مثلاً ۰۹۱۲۳۴۵۶۷۸۹";
export const WRONG_CODE = "کد اشتباهه؛ دوباره بزن";
const MOBILE = /^09\d{9}$/;
/** After this many wrong codes the visitor is offered a fresh one (with a short wait). */
const MISTAKES_BEFORE_RESEND = 2;
const FRESH_CODE_WAIT = 30;

/** Counts down once a second; `start(n)` begins (or shortens) it. */
function useWait() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return { left, start: useCallback((seconds) => setLeft(seconds), []) };
}

/**
 * The client sign-up as short steps, one question each: phone number -> (texted code) -> name -> password.
 * The first screen asks only for the number and says in one line under the button that continuing accepts
 * the terms. The account is made by `onComplete({ phone, name, password, proof })`, which resolves to an
 * error message (shown under the password) or "" on success.
 *
 * Phone and name are kept for 10 minutes in this tab (signupDraft.js) so Back/Forward does not empty the form.
 * The password is never stored.
 */
export function ClientSignupWizard({ otp, onComplete, busy = false, onLogin = null, className = "", header = null, footer = null, submitLabel = "بساز" }) {
  const needsCode = Boolean(otp?.required);
  const [step, setStep] = useState("phone"); // phone | code | name | password
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [proof, setProof] = useState("");
  const [error, setError] = useState("");
  const [busyStep, setBusyStep] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [verified, setVerified] = useState(false);
  const [busyBlock, setBusyBlock] = useState(false); // the site-wide hourly cap of codes is used up
  const wait = useWait();
  const total = needsCode ? 4 : 3;
  const position = { phone: 1, code: 2, name: needsCode ? 3 : 2, password: needsCode ? 4 : 3 }[step];

  // Read after mount (never during render, so the server and first client render match); declared before the save below.
  useEffect(() => {
    const saved = readSignupDraft();
    if (saved.phone) setPhone(saved.phone);
    if (saved.name) setName(saved.name);
  }, []);
  useEffect(() => { saveSignupDraft({ phone, name }); }, [phone, name]);

  const cleanPhone = toLatinDigits(phone.trim());

  async function sendTheCode() {
    setBusyStep(true);
    setError("");
    setBusyBlock(false);
    try {
      const { ok, payload } = await sendCode(cleanPhone, "register", { type: "client", name: "" });
      if (!ok) {
        // The number already has an account: to the login with it filled in, not an error to read.
        if (payload?.code === "phone_taken" && onLogin) { onLogin(cleanPhone); return false; }
        if (payload?.code === "otp_busy") setBusyBlock(true);
        setError(payload?.error || "پیامک نرفت؛ یه کم بعد دوباره بزن.");
        return false;
      }
      wait.start(otp?.resendSeconds || 60);
      return true;
    } catch {
      setError("اینترنتت کنده؛ دوباره بزن");
      return false;
    } finally {
      setBusyStep(false);
    }
  }

  async function submitPhone() {
    if (!MOBILE.test(cleanPhone)) { setError(PHONE_ERROR); return; }
    if (!needsCode) { setError(""); setStep("name"); return; }
    if (await sendTheCode()) {
      setCode(""); setWrong(0); setAttemptsLeft(null); setVerified(false); setProof("");
      setStep("code");
    }
  }

  async function submitCode() {
    const clean = toLatinDigits(code).trim();
    if (!/^\d{5}$/.test(clean)) { setError("هر ۵ رقم کد رو بزن."); return; }
    setBusyStep(true);
    setError("");
    try {
      const { ok, payload } = await verifyCode(cleanPhone, clean);
      if (ok) {
        setProof(payload.data.proof);
        setVerified(true);
        setTimeout(() => { setVerified(false); setStep("name"); }, 700);
        return;
      }
      if (payload?.code === "wrong") {
        const mistakes = wrong + 1;
        setWrong(mistakes);
        setAttemptsLeft(typeof payload.attemptsLeft === "number" ? payload.attemptsLeft : null);
        setError(WRONG_CODE);
        setCode("");
        if (mistakes >= MISTAKES_BEFORE_RESEND) wait.start(payload.attemptsLeft === 0 ? 0 : FRESH_CODE_WAIT);
        return;
      }
      setError(payload?.error || "کد تأیید نشد؛ دوباره بزن.");
      if (/منقضی/.test(payload?.error || "")) { setWrong(MISTAKES_BEFORE_RESEND); wait.start(0); }
    } catch {
      setError("اینترنتت کنده؛ دوباره بزن");
    } finally {
      setBusyStep(false);
    }
  }

  function submitName() {
    if (!name.trim()) { setError("اسمت چیه؟"); return; }
    setError("");
    setStep("password");
  }

  async function submitPassword() {
    if (password.trim().length < 8) { setError("رمز دست‌کم ۸ حرف باشه."); return; }
    setBusyStep(true);
    setError("");
    try {
      const message = await onComplete({ phone: cleanPhone, name: name.trim(), password, proof });
      if (message) setError(message);
      else clearSignupDraft();
    } finally {
      setBusyStep(false);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    if (busyStep || busy || verified) return;
    if (step === "phone") submitPhone();
    else if (step === "code") submitCode();
    else if (step === "name") submitName();
    else submitPassword();
  }

  function changePhone() {
    setStep("phone"); setError(""); setCode(""); setProof(""); setWrong(0); setAttemptsLeft(null); setBusyBlock(false);
  }

  const showFresh = step === "code" && (wrong >= MISTAKES_BEFORE_RESEND || (wait.left === 0 && !busyStep));
  const freshWaiting = wait.left > 0;

  return (
    <form className={`suw ${className}`.trim()} noValidate onSubmit={onSubmit}>
      {header}
      <p className="suwStep" aria-live="polite">قدم {toPersianDigits(position)} از {toPersianDigits(total)}</p>

      {step === "phone" ? (
        <>
          <h3 className="suwTitle">شماره موبایلت چنده؟</h3>
          <Field label="شماره موبایل" error={error && !busyBlock ? error : ""} hideLabel>
            {(props) => (
              <input {...props} name="phone" placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹" inputMode="tel" dir="ltr" autoComplete="tel" maxLength={11} autoFocus
                value={phone} onChange={(event) => { setPhone(toLatinDigits(event.target.value)); setError(""); setBusyBlock(false); }} />
            )}
          </Field>
          {busyBlock ? (
            <div className="suwBusy" role="alert">
              <p>{error}</p>
              {onLogin ? <button type="button" className="suwLink" onClick={() => onLogin()}>ورود با رمز</button> : null}
            </div>
          ) : null}
          <Button type="submit" block loading={busyStep} loadingLabel="دارم می‌فرستم…">{needsCode ? "کد بفرست" : "ادامه"}</Button>
          <p className="suwTerms">
            با ادامه، <LegalLink doc="terms">قوانین</LegalLink> رو قبول داری
            {" "}<span aria-hidden="true">·</span>{" "}
            <LegalLink doc="privacy">حریم خصوصی</LegalLink>
          </p>
        </>
      ) : null}

      {step === "code" ? (
        <>
          <button type="button" className="suwChange" onClick={changePhone}>تغییر شماره</button>
          <h3 className="suwTitle">کدی که پیامک شد رو بزن</h3>
          <p className="suwHint">کد ۵رقمی برای <b dir="ltr">{toPersianDigits(cleanPhone)}</b> فرستادیم.</p>
          {verified ? (
            <p className="suwOk" role="status"><span className="suwTick" aria-hidden="true"><Check size={18} strokeWidth={3} /></span> شماره تأیید شد</p>
          ) : (
            <>
              <Field label="کد تأیید" error={error} hideLabel>
                {(props) => (
                  <input {...props} name="otpCode" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={5} placeholder="_ _ _ _ _" autoFocus
                    value={code} onChange={(event) => { setCode(toLatinDigits(event.target.value).replace(/\D/g, "")); setError(""); }} />
                )}
              </Field>
              {attemptsLeft !== null && wrong > 0 ? (
                <p className="suwHint" role="status">
                  {attemptsLeft > 0 ? `${toPersianDigits(attemptsLeft)} بار دیگه می‌تونی امتحان کنی` : "این کد دیگه کار نمی‌کنه؛ یه کد تازه بگیر."}
                </p>
              ) : null}
              <Button type="submit" block loading={busyStep} loadingLabel="دارم چک می‌کنم…" disabled={attemptsLeft === 0}>تأیید</Button>
              {showFresh ? (
                <button type="button" className="suwLink" disabled={freshWaiting || busyStep}
                  onClick={async () => { if (await sendTheCode()) { setCode(""); setWrong(0); setAttemptsLeft(null); } }}>
                  {freshWaiting ? `کد تازه بفرست (${toPersianDigits(wait.left)})` : "کد تازه بفرست"}
                </button>
              ) : (
                <p className="suwHint">کد نرسید؟ بعد از {toPersianDigits(wait.left)} ثانیه دیگه می‌تونی دوباره بگیری.</p>
              )}
            </>
          )}
        </>
      ) : null}

      {step === "name" ? (
        <>
          <h3 className="suwTitle">اسمت چیه؟</h3>
          <Field label="اسم" error={error} hideLabel>
            {(props) => (
              <input {...props} name="name" placeholder="اسمت" autoComplete="name" autoFocus
                value={name} onChange={(event) => { setName(event.target.value); setError(""); }} />
            )}
          </Field>
          <Button type="submit" block>ادامه</Button>
          <button type="button" className="suwLink" onClick={changePhone}>برگشت به شماره</button>
        </>
      ) : null}

      {step === "password" ? (
        <>
          <h3 className="suwTitle">یه رمز برای خودت بذار</h3>
          <Field label="رمز" error={error} hint="دست‌کم ۸ حرف" hideLabel>
            {(props) => (
              <div className="suwPassword">
                <input {...props} name="password" type={showPassword ? "text" : "password"} placeholder="رمز (دست‌کم ۸ حرف)" autoComplete="new-password" autoFocus
                  value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} />
                <button type="button" className="suwEye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "قایم کن رمز رو" : "نشونم بده رمز رو"}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}
          </Field>
          <Button type="submit" block loading={busyStep || busy} loadingLabel="دارم حسابت رو می‌سازم…">{submitLabel}</Button>
          <button type="button" className="suwLink" onClick={() => { setError(""); setStep("name"); }}>برگشت</button>
        </>
      ) : null}
      {footer}
    </form>
  );
}
