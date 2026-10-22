"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { Field } from "../../components/ui";
import { login, register } from "../../shared/api/auth";
import { toLatinDigits } from "../../shared/lib/digits";
import { validateLogin } from "../auth/formValidation";
import { ClientSignupWizard } from "../auth/ClientSignupWizard";
import { useOtpConfig } from "../auth/otp";
import { openInAppHref, rememberPendingOpen } from "../../shared/lib/appHandoff";

const EMPTY = { phone: "", password: "" };

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
  }

  /** Creates the account (or logs in); resolves to an error message, or "" when the visitor is in. */
  async function authenticate(signup = null) {
    const phone = toLatinDigits((signup?.phone ?? form.phone).trim());
    const password = signup?.password ?? form.password;
    const result = signup
      ? await register({ type: "client", phone, password, otpProof: signup.proof || undefined, data: { name: signup.name.trim() } })
      : await login({ phone, password });
    if (!result.ok) {
      if (signup && result.status === 409) {
        switchMode("login");
        setForm((current) => ({ ...current, phone }));
        setFormError("این شماره قبلاً ثبت شده؛ با رمز عبورت وارد شو.");
        return "";
      }
      return result.payload?.error || (signup ? "ثبت‌نام انجام نشد؛ دوباره امتحان کن." : "ورود انجام نشد.");
    }
    try {
      window.localStorage.setItem("frfro_last_phone", phone);
    } catch {
      // only a convenience for the next login form
    }
    const user = result.payload?.data?.user || result.payload?.profile;
    return gate.onAccountReady(user, { created: Boolean(signup) });
  }

  async function submitLogin(event) {
    event.preventDefault();
    if (busy) return;
    const found = validateLogin(form);
    if (Object.keys(found).length) {
      setErrors(found);
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
      {isSignup ? (
        <ClientSignupWizard
          className="fsForm"
          otp={otp}
          busy={busy}
          submitLabel="ساخت حساب و وصل شدن"
          onLogin={() => switchMode("login")}
          onComplete={async (values) => {
            setBusy(true);
            try {
              return await authenticate(values);
            } finally {
              setBusy(false);
            }
          }}
          footer={(
            <p className="fsConsent">
              با وصل شدن، نام و شماره‌ات برای «{gate.targetName}» نمایش داده می‌شود تا بتوانند با تو در ارتباط باشند. رمز عبورت فقط پیش خودت می‌ماند.
            </p>
          )}
        />
      ) : (
        <form className="fsForm" noValidate onSubmit={submitLogin}>
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
                placeholder="رمز عبور"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => change("password", event.target.value)}
              />
            )}
          </Field>
          {formError ? <p className="fsError" role="alert">{formError}</p> : null}
          <button type="submit" className="fsSubmit" disabled={busy}>{busy ? "چند لحظه…" : "ورود و وصل شدن"}</button>
        </form>
      )}
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
