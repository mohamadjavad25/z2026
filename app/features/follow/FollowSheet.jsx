"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { Field } from "../../components/ui";
import { login, register } from "../../shared/api/auth";
import { toLatinDigits } from "../../shared/lib/digits";
import { validateLogin, validateSignup } from "../auth/formValidation";
import { OtpCodeStep } from "../auth/OtpCodeStep";
import { useOtpConfig, verifyCode } from "../auth/otp";
import { openInAppHref, rememberPendingOpen } from "../../shared/lib/appHandoff";

const EMPTY = { name: "", phone: "", password: "", agreeTerms: false };

/**
 * The sheet a visitor sees after tapping «وصل شو» without an account: a short sign-up (name, phone,
 * password, and the SMS code when the app asks for it) or a login, then the thank-you. `gate` comes from
 * useFollowGate.
 */
function AccountForm({ gate }) {
  const otp = useOtpConfig();
  const [mode, setMode] = useState("signup");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeStep, setCodeStep] = useState(false);
  const isSignup = mode === "signup";

  function change(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
    setFormError("");
  }

  function switchMode(next) {
    setMode(next);
    setErrors({});
    setFormError("");
    setCodeStep(false);
  }

  /** Creates the account (or logs in); resolves to an error message, or "" when the visitor is in. */
  async function authenticate(proof = "") {
    const phone = toLatinDigits(form.phone.trim());
    const result = isSignup
      ? await register({ type: "client", phone, password: form.password, otpProof: proof || undefined, data: { name: form.name.trim() } })
      : await login({ phone, password: form.password });
    if (!result.ok) {
      if (isSignup && result.status === 409) {
        switchMode("login");
        return "این شماره قبلاً ثبت شده؛ با رمز عبورت وارد شو.";
      }
      return result.payload?.error || (isSignup ? "ثبت‌نام انجام نشد؛ دوباره امتحان کن." : "ورود انجام نشد.");
    }
    try {
      window.localStorage.setItem("frfro_last_phone", phone);
    } catch {
      // only a convenience for the next login form
    }
    const user = result.payload?.data?.user || result.payload?.profile;
    return gate.onAccountReady(user, { created: isSignup });
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const found = isSignup ? validateSignup("client", form) : validateLogin(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    if (isSignup && otp.required) {
      setCodeStep(true);
      return;
    }
    setBusy(true);
    try {
      const message = await authenticate();
      if (message) setFormError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fsBody">
      <p className="fsLead">
        با وصل شدن، «{gate.targetName}» به «سالن و آرتیست من» تو اضافه می‌شود و از همان‌جا با چند ضربه نوبت می‌گیری. فقط یک حساب لازم است؛ چند ثانیه.
      </p>
      <div className="fsModes" role="tablist" aria-label="حساب">
        <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? "is-on" : ""} onClick={() => switchMode("signup")}>حساب جدید</button>
        <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? "is-on" : ""} onClick={() => switchMode("login")}>حساب دارم</button>
      </div>
      <form className={`fsForm${codeStep ? " is-otp" : ""}`} noValidate onSubmit={submit}>
        {isSignup ? (
          <Field label="نام" error={errors.name} hideLabel>
            {(props) => (
              <input {...props} name="name" placeholder="نام یا نام نمایشی" autoComplete="name" value={form.name} onChange={(event) => change("name", event.target.value)} />
            )}
          </Field>
        ) : null}
        <Field label="شماره تماس" error={errors.phone} hideLabel>
          {(props) => (
            <input
              {...props}
              name="phone"
              placeholder="شماره تماس"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
              maxLength={11}
              value={form.phone}
              onChange={(event) => change("phone", toLatinDigits(event.target.value))}
            />
          )}
        </Field>
        <Field label="رمز عبور" error={errors.password} hideLabel>
          {(props) => (
            <input
              {...props}
              name="password"
              type="password"
              placeholder={isSignup ? "رمز عبور (حداقل ۸ کاراکتر)" : "رمز عبور"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={form.password}
              onChange={(event) => change("password", event.target.value)}
            />
          )}
        </Field>
        {isSignup ? (
          <div className="authTermsBlock">
            <label className="authTermsAgreement">
              <input type="checkbox" name="agreeTerms" checked={form.agreeTerms} onChange={(event) => change("agreeTerms", event.target.checked)} />
              <span>
                <a href="/terms" target="_blank" rel="noopener noreferrer">قوانین و مقررات</a>
                {" "}و{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">حریم خصوصی</a>
                {" "}frfro رو خوندم و قبول دارم.
              </span>
            </label>
            {errors.agreeTerms ? <small className="ui-field-error" role="alert">{errors.agreeTerms}</small> : null}
          </div>
        ) : null}
        <p className="fsConsent">
          با وصل شدن، نام و شماره‌ات برای «{gate.targetName}» نمایش داده می‌شود تا بتوانند با تو در ارتباط باشند. رمز عبورت فقط پیش خودت می‌ماند.
        </p>
        {formError ? <p className="fsError" role="alert">{formError}</p> : null}
        {codeStep ? (
          <OtpCodeStep
            phone={toLatinDigits(form.phone.trim())}
            purpose="register"
            resendSeconds={otp.resendSeconds}
            submitLabel="تأیید و وصل شدن"
            busy={busy}
            onEditPhone={() => setCodeStep(false)}
            onSubmit={async (code) => {
              setBusy(true);
              try {
                const verified = await verifyCode(toLatinDigits(form.phone.trim()), code);
                if (!verified.ok) return verified.payload?.error || "تأیید کد انجام نشد.";
                return await authenticate(verified.payload.data.proof);
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <button type="submit" className="fsSubmit" disabled={busy}>
            {busy
              ? "چند لحظه…"
              : isSignup
                ? (otp.required ? "ادامه و تأیید شماره" : "ساخت حساب و وصل شدن")
                : "ورود و وصل شدن"}
          </button>
        )}
      </form>
    </div>
  );
}

function DoneBody({ gate, onClose }) {
  return (
    <div className="fsDone" role="status">
      <span className="fsDoneMark" aria-hidden="true"><Check size={34} strokeWidth={3} /></span>
      <h3>به «{gate.targetName}» وصل شدی</h3>
      <p>
        از حالا در «سالن و آرتیست من» توست و از همان‌جا با چند ضربه نوبت می‌گیری.
        {gate.justCreated ? " حسابت هم ساخته شد؛ هر وقت خواستی می‌توانی پروفایلت را کامل کنی." : ""}
      </p>
      <div className="fsDoneActions">
        <a
          className="fsSubmit"
          href={openInAppHref(gate.targetType, gate.targetId)}
          onClick={() => rememberPendingOpen({ type: gate.targetType, id: gate.targetId, name: gate.targetName })}
        >
          همین حالا نوبت بگیر
        </a>
        <button type="button" className="fsGhost" onClick={onClose}>ادامهٔ دیدن صفحه</button>
      </div>
    </div>
  );
}

export function FollowSheet({ gate }) {
  const open = gate.sheet !== "closed";
  return (
    <>
      <ProfileSheet
        open={open}
        kicker={gate.sheet === "done" ? "انجام شد" : "وصل شدن"}
        title={gate.sheet === "done" ? "خوش آمدی" : gate.targetName}
        panelClassName="fsSheet"
        onClose={gate.closeSheet}
      >
        {gate.sheet === "done" ? <DoneBody gate={gate} onClose={gate.closeSheet} /> : open ? <AccountForm gate={gate} /> : null}
      </ProfileSheet>
      {gate.notice ? <p className="fsToast" role="status">{gate.notice}</p> : null}
    </>
  );
}
