"use client";

import { apiFetch } from "../../shared/api/client";
import { useId, useState } from "react";
import { ChevronLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { beautySpecialtyOptions, profileRoles } from "../../shared/constants/roles";
import { toLatinDigits } from "../../shared/lib/digits";
import { Button, Field } from "../../components/ui";
import { ProfileRoleGrid } from "../profile/ProfileRoleGrid";
import { firstInvalidField, validateLogin, validateSignup } from "./formValidation";
import { SpecialtyMultiSelect } from "./SpecialtyMultiSelect";

// target="_blank" (not next/link) deliberately -- this sits inside a
// half-filled signup form; navigating away in the same tab would lose
// whatever the user already typed.
function TermsAgreement({ error, onChange }) {
  const errorId = useId();
  return (
    <div className="authTermsBlock">
    <label className="authTermsAgreement">
      <input type="checkbox" name="agreeTerms" onChange={onChange} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} />
      <span>
        <a href="/terms" target="_blank" rel="noopener noreferrer">قوانین و مقررات</a>
        {" "}و{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">حریم خصوصی</a>
        {" "}زیبابان رو خوندم و قبول دارم.
      </span>
    </label>
    {error ? <small id={errorId} className="ui-field-error" role="alert">{error}</small> : null}
    </div>
  );
}

function PasswordField({ name, placeholder, autoComplete = "current-password", controlProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="authPasswordField">
      <input
        name={name}
        placeholder={placeholder}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        {...controlProps}
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
    const phoneError = validateLogin({ phone, password: "x" }).phone;
    if (phoneError) {
      setError(phoneError);
      setStatus("error");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const { ok, payload } = await apiFetch("/api/auth/password-reset-requests", {
        method: "POST",
        body: JSON.stringify({ phone })
      });
      if (!ok) {
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
    <form className="signupForm is-login is-recovery" noValidate onSubmit={handleSubmit}>
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
        autoComplete="tel"
        onInput={(event) => { event.currentTarget.value = toLatinDigits(event.currentTarget.value); }}
        maxLength={11}
        value={phone}
        onChange={(event) => { setPhone(event.target.value); setError(""); }}
        aria-invalid={error ? true : undefined}
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

const ROLE_FORMS = {
  salon: {
    title: "سالن زیبایی",
    name: { label: "نام سالن", placeholder: "نام سالن" },
    area: { label: "محدوده فعالیت", placeholder: "محدوده فعالیت" },
    service: { placeholder: "خدمات اصلی" },
    order: ["name", "area", "service"]
  },
  artist: {
    title: "آرتیست",
    name: { label: "نام هنری", placeholder: "نام هنری" },
    area: { label: "محدوده یا سالن محل کار", placeholder: "محدوده / سالن محل کار" },
    service: { placeholder: "تخصص اصلی" },
    order: ["name", "service", "area"]
  },
  client: {
    title: "بانو",
    name: { label: "نام یا نام نمایشی", placeholder: "نام یا نام نمایشی" },
    area: { label: "شهر و محدوده", placeholder: "شهر و محدوده" },
    order: ["name", "area"]
  }
};

const normalizePhoneInput = (event) => { event.currentTarget.value = toLatinDigits(event.currentTarget.value); };

/** Focus the first invalid control; the specialty picker has no real input to focus, so its trigger is used. */
function focusField(form, field) {
  if (!form || !field) return;
  const target = field === "service"
    ? form.querySelector(".specialtySelectTrigger")
    : form.querySelector(`[name="${field}"]`);
  target?.focus?.({ preventScroll: false });
  target?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

/** Shared form state: Persian per-field errors, cleared as the user fixes each field. */
function useAuthForm(validate, onValid) {
  const [errors, setErrors] = useState({});
  const clear = (name) => setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const found = validate(data);
    if (Object.keys(found).length) {
      setErrors(found);
      focusField(form, firstInvalidField(found));
      return;
    }
    setErrors({});
    onValid(event);
  }
  return { errors, clear, handleSubmit, onInput: (event) => event.target?.name && clear(event.target.name) };
}

function PhoneAndPassword({ errors, newPassword }) {
  return (
    <div className="formRow">
      <Field label="شماره تماس" error={errors.phone} hideLabel>
        {(props) => (
          <input name="phone" placeholder="شماره تماس" inputMode="tel" dir="ltr" autoComplete="tel" maxLength={11} onInput={normalizePhoneInput} {...props} />
        )}
      </Field>
      <Field label="رمز عبور" error={errors.password} hideLabel>
        {(props) => (
          <PasswordField
            name="password"
            placeholder={newPassword ? "رمز عبور (حداقل ۸ کاراکتر)" : "رمز عبور"}
            autoComplete={newPassword ? "new-password" : "current-password"}
            controlProps={props}
          />
        )}
      </Field>
    </div>
  );
}

function LoginForm({ authBusy, defaultPhone, onSubmit, onForgot }) {
  const form = useAuthForm(validateLogin, onSubmit);
  return (
    <form className="signupForm is-login" noValidate onSubmit={form.handleSubmit} onInput={form.onInput}>
      <Field label="شماره تماس" error={form.errors.phone} hideLabel>
        {(props) => (
          <input name="phone" placeholder="شماره تماس" inputMode="tel" dir="ltr" autoComplete="tel" maxLength={11} defaultValue={defaultPhone} onInput={normalizePhoneInput} {...props} />
        )}
      </Field>
      <Field label="رمز عبور" error={form.errors.password} hideLabel>
        {(props) => <PasswordField name="password" placeholder="رمز عبور" controlProps={props} />}
      </Field>
      <button type="button" className="authForgotLink" onClick={onForgot}>
        رمز عبور را فراموش کردی؟
      </button>
      <button type="submit" className="profileSubmit" disabled={authBusy}>
        {authBusy ? "در حال ورود…" : "ورود"}
      </button>
    </form>
  );
}

function SignupForm({ type, heroClass, authBusy, onBackToRole, onSwitchToLogin, onProfileSubmit }) {
  const config = ROLE_FORMS[type] || ROLE_FORMS.client;
  const form = useAuthForm((data) => validateSignup(type, data), (event) => onProfileSubmit(event, type));
  const serviceErrorId = useId();
  return (
    <form
      className={`signupForm is-${type} ${heroClass || ""}`}
      noValidate
      onSubmit={form.handleSubmit}
      onInput={form.onInput}
      onChange={(event) => { if (event.target?.name === "agreeTerms") form.clear("agreeTerms"); }}
    >
      <button type="button" className="profileBackButton" onClick={onBackToRole}>
        <ChevronLeft size={17} />
        تغییر نقش
      </button>
      <div className="formTitle">
        <strong>{config.title}</strong>
      </div>
      {config.order.map((field) => {
        if (field === "service") {
          return (
            <div className="ui-field" key="service">
              <SpecialtyMultiSelect
                name="service"
                placeholder={config.service.placeholder}
                options={beautySpecialtyOptions}
                invalid={Boolean(form.errors.service)}
                describedBy={form.errors.service ? serviceErrorId : undefined}
                onChange={() => form.clear("service")}
              />
              {form.errors.service ? <small id={serviceErrorId} className="ui-field-error" role="alert">{form.errors.service}</small> : null}
            </div>
          );
        }
        return (
          <Field key={field} label={config[field].label} error={form.errors[field]} hideLabel>
            {(props) => <input name={field} placeholder={config[field].placeholder} {...props} />}
          </Field>
        );
      })}
      <PhoneAndPassword errors={form.errors} newPassword />
      <Field label="ایمیل (اختیاری)" error={form.errors.email} hideLabel>
        {(props) => <input name="email" type="email" placeholder="ایمیل (اختیاری)" dir="ltr" {...props} />}
      </Field>
      <TermsAgreement error={form.errors.agreeTerms} />
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
          <p className="authGateTagline">رزرو نوبت سالن و آرتیست، در چند ثانیه</p>
        </div>
      </div>

      {authNotice && !recoveryOpen ? <p className="authNotice" role="alert">{authNotice}</p> : null}

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
        <LoginForm authBusy={authBusy} defaultPhone={lastPhone} onSubmit={onLoginSubmit} onForgot={() => setRecoveryOpen(true)} />
        <p className="authSwitchHint is-pageFooter">
          حساب نداری؟{" "}
          <button type="button" onClick={onSwitchToSignup}>
            ثبت‌نام کن
          </button>
        </p>
        </>
        )
      ) : signupStep !== "form" ? null : (
        <SignupForm
          type={profileType === "salon" || profileType === "artist" ? profileType : "client"}
          heroClass={activeRoleMeta.heroClass}
          authBusy={authBusy}
          onBackToRole={onBackToRole}
          onSwitchToLogin={onSwitchToLogin}
          onProfileSubmit={onProfileSubmit}
        />
      )}
    </>
  );
}
