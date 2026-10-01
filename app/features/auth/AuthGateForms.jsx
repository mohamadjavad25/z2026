"use client";

import { useState } from "react";
import { ChevronLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { beautySpecialtyOptions, profileRoles } from "../../shared/constants/roles";
import { ProfileRoleGrid } from "../profile/ProfileRoleGrid";
import { SpecialtyMultiSelect } from "./SpecialtyMultiSelect";

// target="_blank" (not next/link) deliberately -- this sits inside a
// half-filled signup form; navigating away in the same tab would lose
// whatever the user already typed.
function TermsAgreement() {
  return (
    <label className="authTermsAgreement">
      <input type="checkbox" name="agreeTerms" required />
      <span>
        <a href="/terms" target="_blank" rel="noopener noreferrer">قوانین و مقررات</a>
        {" "}و{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">حریم خصوصی</a>
        {" "}زیبابان رو خوندم و قبول دارم.
      </span>
    </label>
  );
}

function PasswordField({ name, placeholder, ariaLabel, required, minLength, onInput, defaultValue }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="authPasswordField">
      <input
        name={name}
        placeholder={placeholder}
        aria-label={ariaLabel}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        onInput={onInput}
        defaultValue={defaultValue}
      />
      <button
        type="button"
        className="authPasswordToggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// No SMS/OTP provider is wired in yet, so this can't be real self-service
// password reset — it files a manual-recovery request the founder/support
// follows up on by phone (see app/api/auth/password-reset-requests). Still
// strictly better than the previous dead end (no recovery path at all).
function PasswordRecoveryPanel({ onClose }) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/auth/password-reset-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "ثبت درخواست انجام نشد.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="signupForm is-login is-recovery">
        <div className="formTitle">
          <span className="formTitleIcon"><ShieldCheck size={18} /></span>
          <div>
            <strong>درخواست ثبت شد</strong>
            <span>تیم پشتیبانی طی ۲۴ ساعت با همین شماره تماس می‌گیرد.</span>
          </div>
        </div>
        <button type="button" className="profileSubmit" onClick={onClose}>بازگشت به ورود</button>
      </div>
    );
  }

  return (
    <form className="signupForm is-login is-recovery" onSubmit={handleSubmit}>
      <div className="formTitle">
        <span className="formTitleIcon"><ShieldCheck size={18} /></span>
        <div>
          <strong>بازیابی رمز عبور</strong>
          <span>شماره تماس حسابت را وارد کن تا پشتیبانی برای بازیابی تماس بگیرد.</span>
        </div>
      </div>
      <input
        name="phone"
        placeholder="شماره تماس"
        aria-label="شماره تماس"
        inputMode="tel"
        dir="ltr"
        maxLength={11}
        pattern="09[0-9]{9}"
        title="شماره موبایل معتبر وارد کن (مثلا 09123456789)"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        required
      />
      {error ? <p className="authNotice" role="alert">{error}</p> : null}
      <button type="submit" className="profileSubmit" disabled={status === "sending"}>
        {status === "sending" ? "در حال ارسال…" : "ثبت درخواست بازیابی"}
      </button>
      <p className="authSwitchHint">
        <button type="button" onClick={onClose}>بازگشت به ورود</button>
      </p>
    </form>
  );
}

/**
 * Unauthenticated gate: hero copy, role grid, login + role signup forms.
 * Authenticated profile chrome stays in HomeApp.
 */
export function AuthGateForms({
  authMode,
  signupStep,
  authNotice,
  authBusy = false,
  profileType,
  activeRoleMeta,
  onSelectRole,
  onSwitchToLogin,
  onSwitchToSignup,
  onBackToRole,
  onLoginSubmit,
  onProfileSubmit
}) {
  const lastPhone =
    typeof window !== "undefined" ? window.localStorage.getItem("zibaban_last_phone") || "" : "";
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  return (
    <>
      <div className="authGateHero" data-mode={authMode} data-step={signupStep}>
        <div className="authGateCopy">
          <p className="authGateBrand">زیبابان</p>
        </div>
      </div>

      {authNotice ? <p className="authNotice" role="alert">{authNotice}</p> : null}

      {authMode === "signup" && signupStep === "role" && (
        <div className="authGateDock">
          <ProfileRoleGrid roles={profileRoles} onSelectRole={onSelectRole} />
          <p className="authGateLoginCue">
            حساب داری؟{" "}
            <button type="button" onClick={onSwitchToLogin}>
              ورود
            </button>
          </p>
        </div>
      )}

      {authMode === "login" ? (
        recoveryOpen ? (
          <PasswordRecoveryPanel onClose={() => setRecoveryOpen(false)} />
        ) : (
        <>
        <form className="signupForm is-login" onSubmit={onLoginSubmit}>
          <input
            name="phone"
            placeholder="شماره تماس"
            aria-label="شماره تماس"
            inputMode="tel"
            dir="ltr"
            maxLength={11}
            defaultValue={lastPhone}
            required
          />
          <PasswordField name="password" placeholder="رمز عبور" ariaLabel="رمز عبور" required />
          <button type="button" className="authForgotLink" onClick={() => setRecoveryOpen(true)}>
            رمز عبور را فراموش کردی؟
          </button>
          <button type="submit" className="profileSubmit" disabled={authBusy}>
            {authBusy ? "در حال ورود…" : "ورود"}
          </button>
        </form>
        <p className="authSwitchHint is-pageFooter">
          حساب نداری؟{" "}
          <button type="button" onClick={onSwitchToSignup}>
            ثبت‌نام کن
          </button>
        </p>
        </>
        )
      ) : signupStep !== "form" ? null : profileType === "salon" ? (
        <form className={`signupForm is-salon ${activeRoleMeta.heroClass}`} onSubmit={(event) => onProfileSubmit(event, "salon")}>
          <button type="button" className="profileBackButton" onClick={onBackToRole}>
            <ChevronLeft size={17} />
            تغییر نقش
          </button>
          <div className="formTitle">
            <strong>سالن زیبایی</strong>
          </div>
          <input name="name" placeholder="نام سالن" aria-label="نام سالن" required />
          <input name="area" placeholder="محدوده فعالیت" aria-label="محدوده فعالیت" required />
          <SpecialtyMultiSelect name="service" placeholder="خدمات اصلی" options={beautySpecialtyOptions} required />
          <div className="formRow">
            <input
              name="phone"
              placeholder="شماره تماس"
              aria-label="شماره تماس"
              inputMode="tel"
              dir="ltr"
              maxLength={11}
              pattern="09[0-9]{9}"
              title="شماره موبایل معتبر وارد کن (مثلا 09123456789)"
              required
            />
            <PasswordField name="password" placeholder="رمز کاربر" ariaLabel="رمز کاربر" required minLength={8} />
          </div>
          <input name="email" placeholder="ایمیل (اختیاری)" aria-label="ایمیل اختیاری" type="email" />
          <TermsAgreement />
          <button type="submit" className="profileSubmit" disabled={authBusy}>
            {authBusy ? "در حال ثبت…" : "تکمیل ثبت‌نام"}
          </button>
          <p className="authSwitchHint">
            قبلاً ثبت‌نام کردی؟{" "}
            <button type="button" onClick={onSwitchToLogin}>
              ورود
            </button>
          </p>
        </form>
      ) : profileType === "artist" ? (
        <form className={`signupForm is-artist ${activeRoleMeta.heroClass}`} onSubmit={(event) => onProfileSubmit(event, "artist")}>
          <button type="button" className="profileBackButton" onClick={onBackToRole}>
            <ChevronLeft size={17} />
            تغییر نقش
          </button>
          <div className="formTitle">
            <strong>آرتیست</strong>
          </div>
          <input name="name" placeholder="نام هنری" aria-label="نام هنری" required />
          <SpecialtyMultiSelect name="service" placeholder="تخصص اصلی" options={beautySpecialtyOptions} required />
          <input name="area" placeholder="محدوده / سالن محل کار" aria-label="محدوده یا سالن محل کار" required />
          <div className="formRow">
            <input
              name="phone"
              placeholder="شماره تماس"
              aria-label="شماره تماس"
              inputMode="tel"
              dir="ltr"
              maxLength={11}
              pattern="09[0-9]{9}"
              title="شماره موبایل معتبر وارد کن (مثلا 09123456789)"
              required
            />
            <PasswordField name="password" placeholder="رمز کاربر" ariaLabel="رمز کاربر" required minLength={8} />
          </div>
          <input name="email" placeholder="ایمیل (اختیاری)" aria-label="ایمیل اختیاری" type="email" />
          <TermsAgreement />
          <button type="submit" className="profileSubmit" disabled={authBusy}>
            {authBusy ? "در حال ثبت…" : "تکمیل ثبت‌نام"}
          </button>
          <p className="authSwitchHint">
            قبلاً ثبت‌نام کردی؟{" "}
            <button type="button" onClick={onSwitchToLogin}>
              ورود
            </button>
          </p>
        </form>
      ) : (
        <form className={`signupForm is-client ${activeRoleMeta.heroClass}`} onSubmit={(event) => onProfileSubmit(event, "client")}>
          <button type="button" className="profileBackButton" onClick={onBackToRole}>
            <ChevronLeft size={17} />
            تغییر نقش
          </button>
          <div className="formTitle">
            <strong>بانو</strong>
          </div>
          <input name="name" placeholder="نام یا نام نمایشی" aria-label="نام یا نام نمایشی" required />
          <input name="area" placeholder="شهر و محدوده" aria-label="شهر و محدوده" required />
          <div className="formRow">
            <input
              name="phone"
              placeholder="شماره تماس"
              aria-label="شماره تماس"
              inputMode="tel"
              dir="ltr"
              maxLength={11}
              pattern="09[0-9]{9}"
              title="شماره موبایل معتبر وارد کن (مثلا 09123456789)"
              required
            />
            <PasswordField name="password" placeholder="رمز کاربر" ariaLabel="رمز کاربر" required minLength={8} />
          </div>
          <input name="email" placeholder="ایمیل (اختیاری)" aria-label="ایمیل اختیاری" type="email" />
          <TermsAgreement />
          <button type="submit" className="profileSubmit" disabled={authBusy}>
            {authBusy ? "در حال ثبت…" : "تکمیل ثبت‌نام"}
          </button>
          <p className="authSwitchHint">
            قبلاً ثبت‌نام کردی؟{" "}
            <button type="button" onClick={onSwitchToLogin}>
              ورود
            </button>
          </p>
        </form>
      )}
    </>
  );
}
