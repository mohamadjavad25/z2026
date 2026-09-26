"use client";

import { useState } from "react";
import {
  Brush,
  ChevronLeft,
  Eye,
  EyeOff,
  Scissors,
  ShieldCheck,
  UserRound
} from "lucide-react";
import {
  artistSpecialties,
  profileRoles,
  salonRegistrationServices
} from "../../shared/constants/roles";
import { ProfileRoleGrid } from "../profile/ProfileRoleGrid";

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
      <label>
        شماره تماس
        <input
          name="phone"
          placeholder="09..."
          inputMode="tel"
          dir="ltr"
          maxLength={11}
          pattern="09[0-9]{9}"
          title="شماره موبایل معتبر وارد کن (مثلا 09123456789)"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
      </label>
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
          <label>
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
          </label>
          <label>
            <PasswordField name="password" placeholder="رمز عبور" ariaLabel="رمز عبور" required />
          </label>
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
            <span className="formTitleIcon"><Scissors size={18} /></span>
            <strong>سالن زیبایی</strong>
          </div>
          <label>
            نام سالن
            <input name="name" placeholder="مثلا سالن روژان" required />
          </label>
          <label>
            محدوده فعالیت
            <input name="area" placeholder="مثلا جردن، سعادت‌آباد..." required />
          </label>
          <label>
            خدمات اصلی
            <select name="service" defaultValue="" required>
              <option value="" disabled>
                انتخاب کن
              </option>
              <option>تمام خدمات</option>
              {salonRegistrationServices.map((service) => (
                <option key={service}>{service}</option>
              ))}
            </select>
          </label>
          <label>
            شماره تماس
            <input
              name="phone"
              placeholder="09..."
              inputMode="tel"
              dir="ltr"
              maxLength={11}
              pattern="09[0-9]{9}"
              title="شماره موبایل معتبر وارد کن (مثلا 09123456789)"
              required
            />
          </label>
          <label>
            رمز کاربر
            <PasswordField name="password" placeholder="حداقل ۸ کاراکتر" required minLength={8} />
          </label>
          <label>
            ایمیل اختیاری
            <input name="email" placeholder="salon@email.com" type="email" />
          </label>
          <button type="submit" className="profileSubmit" disabled={authBusy}>
            {authBusy ? "در حال ثبت…" : "ساخت پروفایل سالن"}
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
            <span className="formTitleIcon"><Brush size={18} /></span>
            <strong>آرتیست</strong>
          </div>
          <label>
            نام هنری
            <input name="name" placeholder="مثلا لنا میکاپ" required />
          </label>
          <label>
            تخصص اصلی
            <select name="service" defaultValue="" required>
              <option value="" disabled>
                انتخاب کن
              </option>
              {artistSpecialties.map((specialty) => (
                <option key={specialty}>{specialty}</option>
              ))}
            </select>
          </label>
          <label>
            محدوده / سالن محل کار
            <input name="area" placeholder="مثلا جردن · سالن روژان" required />
          </label>
          <label>
            شماره تماس
            <input
              name="phone"
              placeholder="09..."
              inputMode="tel"
              dir="ltr"
              maxLength={11}
              pattern="09[0-9]{9}"
              title="شماره موبایل معتبر وارد کن (مثلا 09123456789)"
              required
            />
          </label>
          <label>
            رمز کاربر
            <PasswordField name="password" placeholder="حداقل ۸ کاراکتر" required minLength={8} />
          </label>
          <label>
            ایمیل اختیاری
            <input name="email" placeholder="artist@email.com" type="email" />
          </label>
          <button type="submit" className="profileSubmit" disabled={authBusy}>
            {authBusy ? "در حال ثبت…" : "ساخت پروفایل آرتیست"}
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
            <span className="formTitleIcon"><UserRound size={18} /></span>
            <strong>بانو</strong>
          </div>
          <label>
            نام یا نام نمایشی
            <input name="name" placeholder="مثلا نازنین" required />
          </label>
          <label>
            شهر و محدوده
            <input name="area" placeholder="مثلا تهران، جردن" required />
          </label>
          <label>
            شماره تماس
            <input
              name="phone"
              placeholder="09..."
              inputMode="tel"
              dir="ltr"
              maxLength={11}
              pattern="09[0-9]{9}"
              title="شماره موبایل معتبر وارد کن (مثلا 09123456789)"
              required
            />
          </label>
          <label>
            رمز کاربر
            <PasswordField name="password" placeholder="حداقل ۸ کاراکتر" required minLength={8} />
          </label>
          <label>
            ایمیل اختیاری
            <input name="email" placeholder="name@email.com" type="email" />
          </label>
          <button type="submit" className="profileSubmit" disabled={authBusy}>
            {authBusy ? "در حال ثبت…" : "ساخت پروفایل بانو"}
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
