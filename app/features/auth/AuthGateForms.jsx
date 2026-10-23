"use client";

import { apiFetch } from "../../shared/api/client";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, Download, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { profileRoles } from "../../shared/constants/roles";
import { toLatinDigits } from "../../shared/lib/digits";
import { Button, Field } from "../../components/ui";
import { Mascot } from "../../components/Mascot";
import { ProfileRoleGrid } from "../profile/ProfileRoleGrid";
import { firstInvalidField, validateLogin, validateSignup } from "./formValidation";
import { APP_DOWNLOADS_OPEN } from "../landing/constants";
import { OtpCodeStep } from "./OtpCodeStep";
import { ClientSignupWizard } from "./ClientSignupWizard";
import { confirmReset, useOtpConfig, verifyCode } from "./otp";

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
        {" "}رو خوندم و قبول دارم.
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
        aria-label={visible ? "قایم کن رمز رو" : "نشونم بده رمز رو"}
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
function PasswordRecoveryPanel({ onClose, otp }) {
  const [phone, setPhone] = useState("");
  const [codeStep, setCodeStep] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);
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
    if (otp?.enabled) {
      setError("");
      setCodeStep(true);
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
        setError(payload.error || "نشد بفرستیم؛ دوباره بزن.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("به سرور نرسیدیم؛ اینترنتت رو یه نگاه بنداز.");
      setStatus("error");
    }
  }

  if (resetDone) {
    return (
      <div className="signupForm is-login is-recovery">
        <div className="formTitle">
          <span className="formTitleIcon"><ShieldCheck size={18} /></span>
          <div>
            <strong>رمزت عوض شد</strong>
            <span>حالا با رمز تازه وارد شو.</span>
          </div>
        </div>
        <button type="button" className="profileSubmit" onClick={onClose}>بریم ورود</button>
      </div>
    );
  }

  if (codeStep) {
    return (
      <div className="signupForm is-login is-recovery">
        <div className="formTitle">
          <span className="formTitleIcon"><ShieldCheck size={18} /></span>
          <div>
            <strong>رمزت یادت رفته؟</strong>
            <span>کدی که پیامک شد و رمز تازه‌ت رو بزن.</span>
          </div>
        </div>
        <OtpCodeStep
          phone={phone}
          purpose="reset"
          resendSeconds={otp.resendSeconds}
          submitLabel="عوضش کن"
          onEditPhone={() => setCodeStep(false)}
          onSubmit={async (code) => {
            if (newPassword.length < 8) return "رمز تازه دست‌کم ۸ حرف باشه.";
            const { ok, payload } = await confirmReset({ phone, code, newPassword });
            if (!ok) return payload.error || "رمز عوض نشد؛ دوباره بزن.";
            setResetDone(true);
            return "";
          }}
        >
          <input
            type="password"
            name="newPassword"
            aria-label="رمز تازه"
            placeholder="رمز تازه (دست‌کم ۸ حرف)"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </OtpCodeStep>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className="signupForm is-login is-recovery">
        <div className="formTitle">
          <span className="formTitleIcon"><ShieldCheck size={18} /></span>
          <div>
            <strong>درخواستت رسید</strong>
            <span>پشتیبانی تا ۲۴ ساعت دیگه به همین شماره زنگ می‌زنه.</span>
          </div>
        </div>
        <Mascot pose="done" size={140} className="mascotEmpty" />
        <button type="button" className="profileSubmit" onClick={onClose}>برگرد به ورود</button>
      </div>
    );
  }

  return (
    <form className="signupForm is-login is-recovery" noValidate onSubmit={handleSubmit}>
      <div className="formTitle">
        <span className="formTitleIcon"><ShieldCheck size={18} /></span>
        <div>
          <strong>رمزت یادت رفته؟</strong>
          <span>{otp?.enabled ? "شماره‌ت رو بزن تا یه کد برات پیامک کنیم." : "شمارهٔ حسابت رو بزن تا پشتیبانی بهت زنگ بزنه."}</span>
        </div>
      </div>
      <input
        name="phone"
        placeholder="شماره موبایل"
        aria-label="شماره موبایل"
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
        {status === "sending" ? "دارم می‌فرستم…" : otp?.enabled ? "کد بفرست" : "زنگم بزنید"}
      </button>
      <p className="authSwitchHint">
        <button type="button" onClick={onClose}>برگرد به ورود</button>
      </p>
    </form>
  );
}

const ROLE_FORMS = {
  salon: {
    title: "سالن",
    subtitle: "فقط سه تا چیز؛ بقیه‌ش بعداً.",
    name: { label: "اسم سالن", placeholder: "اسم سالن" },
    order: ["name"]
  },
  artist: {
    title: "آرتیست",
    subtitle: "فقط سه تا چیز؛ بقیه‌ش بعداً.",
    name: { label: "اسم هنری", placeholder: "اسم هنری" },
    order: ["name"]
  },
  client: {
    title: "مشتری",
    subtitle: "چند ثانیه تا اولین نوبتت.",
    name: { label: "اسمت", placeholder: "اسمت" },
    area: { label: "شهر (اختیاری)", placeholder: "شهر (اختیاری)" },
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
      <Field label="شماره موبایل" error={errors.phone} hideLabel>
        {(props) => (
          <input name="phone" placeholder="شماره موبایل" inputMode="tel" dir="ltr" autoComplete="tel" maxLength={11} onInput={normalizePhoneInput} {...props} />
        )}
      </Field>
      <Field label="رمز" error={errors.password} hideLabel>
        {(props) => (
          <PasswordField
            name="password"
            placeholder={newPassword ? "رمز (دست‌کم ۸ حرف)" : "رمز"}
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
      <Field label="شماره موبایل" error={form.errors.phone} hideLabel>
        {(props) => (
          <input name="phone" placeholder="شماره موبایل" inputMode="tel" dir="ltr" autoComplete="tel" maxLength={11} defaultValue={defaultPhone} onInput={normalizePhoneInput} {...props} />
        )}
      </Field>
      <Field label="رمز" error={form.errors.password} hideLabel>
        {(props) => <PasswordField name="password" placeholder="رمز" controlProps={props} />}
      </Field>
      <button type="button" className="authForgotLink" onClick={onForgot}>
        رمزت یادت رفته؟
      </button>
      <button type="submit" className="profileSubmit" disabled={authBusy}>
        {authBusy ? "دارم وارد می‌شم…" : "ورود"}
      </button>
    </form>
  );
}

/** A client signs up in short steps (ClientSignupWizard); salons and artists keep the one-page form below. */
function ClientSignup({ heroClass, authBusy, onBackToRole, onSwitchToLogin, onProfileSubmit, otp }) {
  return (
    <ClientSignupWizard
      otp={otp}
      busy={authBusy}
      onLogin={onSwitchToLogin}
      className={`signupForm is-client ${heroClass || ""}`}
      header={(
        <>
          <button type="button" className="profileBackButton" onClick={onBackToRole}>
            <ChevronLeft size={17} />
            تغییر نقش
          </button>
          <div className="formTitle">
            <div>
              <strong>{ROLE_FORMS.client.title}</strong>
              <span>{ROLE_FORMS.client.subtitle}</span>
            </div>
          </div>
        </>
      )}
      footer={(
        <p className="authSwitchHint">
          حساب داری؟{" "}
          <button type="button" onClick={onSwitchToLogin}>ورود</button>
        </p>
      )}
      onComplete={({ phone, name, password, proof }) => onProfileSubmit({ preventDefault() {} }, "client", { name, phone, password, otpProof: proof })}
    />
  );
}

function SignupForm({ type, heroClass, authBusy, onBackToRole, onSwitchToLogin, onProfileSubmit, otp }) {
  if (type === "client") return <ClientSignup heroClass={heroClass} authBusy={authBusy} onBackToRole={onBackToRole} onSwitchToLogin={onSwitchToLogin} onProfileSubmit={onProfileSubmit} otp={otp} />;
  return <SalonArtistSignupForm type={type} heroClass={heroClass} authBusy={authBusy} onBackToRole={onBackToRole} onSwitchToLogin={onSwitchToLogin} onProfileSubmit={onProfileSubmit} otp={otp} />;
}

function SalonArtistSignupForm({ type, heroClass, authBusy, onBackToRole, onSwitchToLogin, onProfileSubmit, otp }) {
  const config = ROLE_FORMS[type] || ROLE_FORMS.client;
  const formRef = useRef(null);
  const [codeStep, setCodeStep] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [proof, setProof] = useState("");
  const [verifying, setVerifying] = useState(false);
  const form = useAuthForm((data) => validateSignup(type, data), (event) => {
    // Once SMS is required, the first valid submit opens the code step; the second (after the code) creates the account.
    if (otp?.required && !proof) {
      const fields = new FormData(event.currentTarget);
      setPhone(toLatinDigits(String(fields.get("phone") || "").trim()));
      setName(String(fields.get("name") || "").trim());
      setCodeStep(true);
      return;
    }
    onProfileSubmit(event, type);
  });
  // The code was right -> we hold a proof -> submit the real form again, now carrying it.
  useEffect(() => {
    if (proof) formRef.current?.requestSubmit();
  }, [proof]);
  return (
    <form
      ref={formRef}
      className={`signupForm is-${type} ${heroClass || ""} ${codeStep ? "is-otp" : ""}`}
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
        <div>
          <strong>{config.title}</strong>
          {config.subtitle ? <span>{config.subtitle}</span> : null}
        </div>
      </div>
      {config.order.map((field) => {
        return (
          <Field key={field} label={config[field].label} error={form.errors[field]} hideLabel>
            {(props) => <input name={field} placeholder={config[field].placeholder} {...props} />}
          </Field>
        );
      })}
      <PhoneAndPassword errors={form.errors} newPassword />
      <TermsAgreement error={form.errors.agreeTerms} />
      <input type="hidden" name="otpProof" value={proof} />
      <button type="submit" className="profileSubmit" disabled={authBusy}>
        {authBusy ? "دارم می‌سازم…" : otp?.required ? "ادامه و تأیید شماره" : "بساز"}
      </button>
      {codeStep ? (
        <OtpCodeStep
          phone={phone}
          purpose="register"
          sendExtra={{ type, name }}
          resendSeconds={otp.resendSeconds}
          submitLabel="تأیید و بساز"
          busy={verifying || authBusy}
          onEditPhone={() => { setCodeStep(false); setProof(""); }}
          editLabel="اسم یا شماره رو عوض کن"
          onSubmit={async (code) => {
            setVerifying(true);
            const { ok, payload } = await verifyCode(phone, code);
            setVerifying(false);
            if (!ok) return payload.error || "کد تأیید نشد؛ دوباره بزن.";
            setProof(payload.data.proof);
            return "";
          }}
        />
      ) : null}
      <p className="authSwitchHint">
        حساب داری؟{" "}
        <button type="button" onClick={onSwitchToLogin}>
          ورود
        </button>
      </p>
    </form>
  );
}

const GATE_TAGLINES = {
  default: "زیبایی، یه نوبت فاصله داره",
  login: "خوش برگشتی؛ نوبت‌هات منتظرته",
  client: "سالنت رو پیدا کن، نوبتت رو بگیر",
  salon: "سالنت رو بیار اینجا؛ نوبت‌ها و تیمت یه‌جا",
  artist: "کارهات رو نشون بده، مشتری بیار"
};

// Bottom of the role and login screens, browser only (never inside the app): the download link,
// or «به‌زودی» while the app waits for its store release (APP_DOWNLOADS_OPEN).
function AppDownloadCue() {
  if (!APP_DOWNLOADS_OPEN) {
    return (
      <p className="webAppDownloadLink webAppSoon webOnlyAppLink">
        <Sparkles size={15} aria-hidden="true" />
        به‌زودی: اپلیکیشن و وبلاگ فرفرو
      </p>
    );
  }
  return (
    <a className="webAppDownloadLink webOnlyAppLink" href="/download">
      <Download size={15} aria-hidden="true" />
      دانلود اپلیکیشن فرفرو
    </a>
  );
}

function gateTagline({ authMode, signupStep, profileType, arrivalIntent }) {
  // Came from a salon/artist page to book, or from a salon's team link: say what the account is for.
  if (arrivalIntent?.kind === "open") {
    const place = arrivalIntent.name ? `«${arrivalIntent.name}»` : arrivalIntent.type === "artist" ? "این آرتیست" : "این سالن";
    return authMode === "login" ? `وارد شو تا از ${place} نوبت بگیری` : `یه حساب بساز تا از ${place} نوبت بگیری`;
  }
  if (arrivalIntent?.kind === "join") return authMode === "login" ? "وارد شو تا بری توی تیم سالن" : "حساب آرتیستت رو بساز تا بری توی تیم سالن";
  if (authMode === "login") return GATE_TAGLINES.login;
  if (signupStep === "form") return GATE_TAGLINES[profileType] || GATE_TAGLINES.client;
  return GATE_TAGLINES.default;
}

/**
 * The salon or artist a guest came from (a public page's «رزرو», a shared link or QR), shown above the form so the
 * guest knows which place the account is for (owner's choice 2026-10-23). A bare link carries only the id, so the
 * name and picture come from the public page's data; a private or missing place shows nothing.
 */
function ArrivalPlaceCard({ intent }) {
  const isArtist = intent.type === "artist";
  const [place, setPlace] = useState(intent.name ? { name: intent.name, avatar: "" } : null);
  useEffect(() => {
    if (!intent.id) return undefined;
    let alive = true;
    apiFetch(`/api/${isArtist ? "artists" : "salons"}/${intent.id}`).then(({ ok, payload }) => {
      const found = ok ? (isArtist ? payload.data?.artist : payload.data?.salon) : null;
      if (alive && found?.name) setPlace({ name: found.name, avatar: found.avatar || "", avatarPosition: found.avatarPosition || "" });
    });
    return () => { alive = false; };
  }, [intent.id, isArtist]);
  if (!place?.name) return null;
  return (
    <div className="authArrivalPlace">
      <span className={`authArrivalAvatar${isArtist ? " is-round" : ""}`} aria-hidden="true">
        {place.avatar ? <img src={place.avatar} alt="" style={{ objectPosition: place.avatarPosition || "50% 50%" }} /> : place.name.trim().slice(0, 1)}
      </span>
      <span className="authArrivalText">
        <b>{place.name}</b>
        <small>بعد از ثبت‌نام، یه‌راست می‌ری سراغ خدمات {isArtist ? "همین آرتیست" : "همین سالن"}.</small>
      </span>
    </div>
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
  arrivalIntent = null,
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
    typeof window !== "undefined" ? window.localStorage.getItem("frfro_last_phone") || "" : "";
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const otp = useOtpConfig();

  return (
    <>
      <div className="authGateHero" data-mode={authMode} data-step={signupStep}>
        <div className="authGateCopy">
          <p className="authGateBrand">frfro</p>
          <p className="authGateTagline">{gateTagline({ authMode, signupStep, profileType, arrivalIntent })}</p>
        </div>
      </div>
      {arrivalIntent?.kind === "open" ? <ArrivalPlaceCard intent={arrivalIntent} /> : null}

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
          <AppDownloadCue />
        </div>
      )}

      {authMode === "login" ? (
        recoveryOpen ? (
          <PasswordRecoveryPanel onClose={() => setRecoveryOpen(false)} otp={otp} />
        ) : (
        <>
        <LoginForm authBusy={authBusy} defaultPhone={lastPhone} onSubmit={onLoginSubmit} onForgot={() => setRecoveryOpen(true)} />
        <p className="authSwitchHint is-pageFooter">
          حساب نداری؟{" "}
          <button type="button" onClick={onSwitchToSignup}>
            ثبت‌نام کن
          </button>
        </p>
        <AppDownloadCue />
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
          otp={otp}
        />
      )}
    </>
  );
}
