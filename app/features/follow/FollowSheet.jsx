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
        setFormError("این شماره حساب داره؛ با رمزت وارد شو.");
        return "";
      }
      return result.payload?.error || (signup ? "حساب ساخته نشد؛ دوباره بزن." : "وارد نشدی؛ دوباره بزن.");
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
        وصل که بشی، «{gate.targetName}» میاد توی سالن و آرتیست‌هات و از همون‌جا با چند ضربه نوبت می‌گیری. فقط یه حساب می‌خواد؛ چند ثانیه.
      </p>
      <div className="fsModes" role="tablist" aria-label="حساب">
        <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? "is-on" : ""} onClick={() => switchMode("signup")}>حساب تازه</button>
        <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? "is-on" : ""} onClick={() => switchMode("login")}>حساب دارم</button>
      </div>
      {isSignup ? (
        <ClientSignupWizard
          className="fsForm"
          otp={otp}
          busy={busy}
          submitLabel="بساز و وصل شو"
          onLogin={(phone) => {
            switchMode("login");
            if (typeof phone === "string" && phone) {
              setForm((current) => ({ ...current, phone }));
              setFormError("این شماره حساب داره؛ با رمزت وارد شو.");
            }
          }}
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
              وصل که بشی، «{gate.targetName}» اسم و شماره‌ت رو می‌بینه تا بتونه باهات در تماس باشه. رمزت فقط پیش خودت می‌مونه.
            </p>
          )}
        />
      ) : (
        <form className="fsForm" noValidate onSubmit={submitLogin}>
          <Field label="شماره موبایل" error={errors.phone} hideLabel>
            {(props) => (
              <input
                {...props}
                name="phone"
                placeholder="شماره موبایل"
                inputMode="tel"
                dir="ltr"
                autoComplete="tel"
                maxLength={11}
                value={form.phone}
                onChange={(event) => change("phone", toLatinDigits(event.target.value))}
              />
            )}
          </Field>
          <Field label="رمز" error={errors.password} hideLabel>
            {(props) => (
              <input
                {...props}
                name="password"
                type="password"
                placeholder="رمز"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => change("password", event.target.value)}
              />
            )}
          </Field>
          {formError ? <p className="fsError" role="alert">{formError}</p> : null}
          <button type="submit" className="fsSubmit" disabled={busy}>{busy ? "یه لحظه…" : "وارد شو"}</button>
        </form>
      )}
    </div>
  );
}

/** A salon or artist opened a page meant for clients: what happened (an invite) or what to do instead. */
function OwnerBody({ gate, onClose }) {
  return (
    <div className="fsDone" role="status">
      <h3>{gate.outcome?.title}</h3>
      <p>{gate.outcome?.text}</p>
      <div className="fsDoneActions">
        <a className="fsSubmit" href="/" onClick={() => { try { window.localStorage.setItem("frfro-entered", "1"); } catch { /* private mode */ } }}>
          برو به فرفرو
        </a>
        <button type="button" className="fsGhost" onClick={onClose}>صفحه رو ببینم</button>
      </div>
    </div>
  );
}

function DoneBody({ gate, onClose }) {
  return (
    <div className="fsDone" role="status">
      <span className="fsDoneMark" aria-hidden="true"><Check size={34} strokeWidth={3} /></span>
      <h3>به «{gate.targetName}» وصل شدی</h3>
      <p>
        از حالا توی سالن و آرتیست‌هاته و از همون‌جا با چند ضربه نوبت می‌گیری.
        {gate.justCreated ? " حسابت هم ساخته شد؛ هر وقت خواستی پروفایلت رو کامل کن." : ""}
      </p>
      <div className="fsDoneActions">
        <a
          className="fsSubmit"
          href={openInAppHref(gate.targetType, gate.targetId)}
          onClick={() => rememberPendingOpen({ type: gate.targetType, id: gate.targetId, name: gate.targetName })}
        >
          همین الان نوبت بگیر
        </a>
        <button type="button" className="fsGhost" onClick={onClose}>صفحه رو ببینم</button>
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
        title={gate.sheet === "done" ? "خوش اومدی!" : gate.targetName}
        panelClassName="fsSheet"
        onClose={gate.closeSheet}
      >
        {gate.sheet === "done" ? <DoneBody gate={gate} onClose={gate.closeSheet} />
          : gate.sheet === "owner" ? <OwnerBody gate={gate} onClose={gate.closeSheet} />
          : open ? <AccountForm gate={gate} /> : null}
      </ProfileSheet>
      {gate.notice ? <p className="fsToast" role="status">{gate.notice}</p> : null}
    </>
  );
}
