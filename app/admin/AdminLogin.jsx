"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { apiFetch } from "../shared/api/client";
import { Button, Field } from "../components/ui";

const ltr = { dir: "ltr", autoComplete: "off", autoCapitalize: "off", spellCheck: false };
const PHONE_KEY = "frfro-admin-phone";
const digits = (value) => String(value || "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "");

/** Admin sign-in in two steps: phone + admin password first, then only the authenticator code, which signs in by itself at
 *  6 digits, so the code is opened last and never runs out while the rest is typed (owner's request 2026-10-27). No app account needed. "First-time setup" (also after a lost
 *  password or phone) sets a new admin password and links an authenticator app; it needs the setup key from the server's env. */
export function AdminLogin({ configured, setupKeyConfigured = true, onDone }) {
  const [mode, setMode] = useState("login"); // login | code | setup | scan
  const [form, setForm] = useState({ phone: "", password: "", code: "", setupKey: "" });
  const [qr, setQr] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const secretType = reveal ? "text" : "password";
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const sent = useRef("");

  // The phone is remembered on this device, so next time only the password and the code are typed.
  useEffect(() => {
    try {
      const phone = localStorage.getItem(PHONE_KEY);
      if (phone) setForm((prev) => (prev.phone ? prev : { ...prev, phone }));
    } catch {}
  }, []);

  async function submit(path, body, next) {
    setBusy(true);
    setError("");
    const { ok, payload } = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!ok) return setError(payload.error || "ورود انجام نشد.");
    next(payload.data);
  }

  const toCode = (event) => {
    event.preventDefault();
    try { localStorage.setItem(PHONE_KEY, form.phone.trim()); } catch {}
    setError("");
    setForm((prev) => ({ ...prev, code: "" }));
    sent.current = "";
    setMode("code");
  };
  const login = (code) => {
    sent.current = code;
    submit("/api/admin/auth/login", { phone: form.phone, password: form.password, code }, onDone);
  };
  const onLogin = (event) => {
    event.preventDefault();
    login(digits(form.code));
  };
  // Six digits typed or pasted: sign in at once, once per code.
  const onCode = (event) => {
    const code = digits(event.target.value).slice(0, 6);
    setForm((prev) => ({ ...prev, code }));
    if (code.length === 6 && code !== sent.current && !busy) {
      if (mode === "code") login(code);
      else {
        sent.current = code;
        submit("/api/admin/auth/enroll/confirm", { phone: form.phone, password: form.password, setupKey: form.setupKey, code }, onDone);
      }
    }
  };
  const onSetup = (event) => {
    event.preventDefault();
    submit("/api/admin/auth/enroll/start", { phone: form.phone, password: form.password, setupKey: form.setupKey }, (data) => {
      setQr(data);
      setMode("scan");
    });
  };
  const onConfirm = (event) => {
    event.preventDefault();
    submit("/api/admin/auth/enroll/confirm", { phone: form.phone, password: form.password, setupKey: form.setupKey, code: form.code }, onDone);
  };

  if (!configured) {
    return (
      <main className="adm admLoginWrap">
        <section className="admCard admLogin">
          <h1>ورود مدیریت</h1>
          <p className="admError" role="alert">ورود مدیریت هنوز روی سرور فعال نشده است (متغیر FRFRO_ADMIN_SECRET تنظیم نشده).</p>
        </section>
      </main>
    );
  }

  return (
    <main className="adm admLoginWrap">
      <section className="admCard admLogin">
        <span className="admLogo"><ShieldCheck size={26} aria-hidden="true" /></span>
        <h1>ورود مدیریت</h1>
        {mode === "login" ? (
          <form onSubmit={toCode} className="admForm">
            <Field label="شمارهٔ موبایل">{(p) => <input {...p} {...ltr} inputMode="tel" autoComplete="username" value={form.phone} onChange={set("phone")} required />}</Field>
            <Field label="رمز مدیر">{(p) => <input {...p} {...ltr} type={secretType} autoComplete="current-password" value={form.password} onChange={set("password")} required />}</Field>
            <Button type="submit">ادامه</Button>
            <div className="admFirstTime">
              <p className="admMuted">اولین بار است، یا رمز مدیر یا گوشی‌ات را گم کرده‌ای؟ لازم نیست در اپ ثبت‌نام کرده باشی.</p>
              <Button type="button" variant="secondary" onClick={() => { setError(""); setMode("setup"); }}>راه‌اندازی اولیه (دریافت QR)</Button>
            </div>
          </form>
        ) : null}
        {mode === "code" ? (
          <form onSubmit={onLogin} className="admForm">
            <p className="admMuted">حالا برنامهٔ Authenticator را باز کن و کد ۶ رقمی را بزن. با رقم ششم خودش وارد می‌شوی.</p>
            <Field label="کد ۶ رقمی">{(p) => <input {...p} {...ltr} inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={12} value={form.code} onChange={onCode} required />}</Field>
            {error ? <p className="admError" role="alert">{error}</p> : null}
            <Button type="submit" disabled={busy}>{busy ? "در حال بررسی…" : "ورود"}</Button>
            <button type="button" className="admLink" onClick={() => { setError(""); setMode("login"); }}>شماره یا رمز را عوض کن</button>
          </form>
        ) : null}
        {mode === "setup" ? (
          <form onSubmit={onSetup} className="admForm">
            <p className="admMuted">با «کلید راه‌اندازی» سرور، یک رمز مدیر تازه می‌سازی و برنامهٔ Authenticator را وصل می‌کنی. رمز و کد قبلی تا آخر همین کار کار می‌کنند.</p>
            <Field label="شمارهٔ موبایل">{(p) => <input {...p} {...ltr} inputMode="tel" autoComplete="username" value={form.phone} onChange={set("phone")} required />}</Field>
            <Field label="رمز مدیر تازه (دست‌کم ۸ حرف)">{(p) => <input {...p} {...ltr} type={secretType} autoComplete="new-password" minLength={8} value={form.password} onChange={set("password")} required />}</Field>
            <Field label="کلید راه‌اندازی">{(p) => <input {...p} {...ltr} type={secretType} value={form.setupKey} onChange={set("setupKey")} required />}</Field>
            <label className="admReveal"><input type="checkbox" checked={reveal} onChange={(event) => setReveal(event.target.checked)} /> نمایش رمز و کلید هنگام تایپ</label>
            {!setupKeyConfigured ? <p className="admError" role="alert">کلید راه‌اندازی روی سرور تنظیم نشده یا کمتر از ۱۶ نویسه است. در Vercel متغیر FRFRO_ADMIN_SETUP_KEY را (حداقل ۱۶ نویسه) بگذار و دوباره Redeploy کن؛ تا آن موقع راه‌اندازی هر ورودی را رد می‌کند.</p> : null}
            {error ? <p className="admError" role="alert">{error}</p> : null}
            <Button type="submit" disabled={busy}>{busy ? "در حال بررسی…" : "ادامه"}</Button>
            <button type="button" className="admLink" onClick={() => { setError(""); setMode("login"); }}>بازگشت به ورود</button>
          </form>
        ) : null}
        {mode === "scan" && qr ? (
          <form onSubmit={onConfirm} className="admForm">
            <p className="admMuted">این QR را در برنامهٔ Authenticator گوشی اسکن کن (یا کلید زیر را دستی وارد کن). بعد کد ۶ رقمی که نشان می‌دهد را بزن.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="admQr" src={qr.qr} alt="QR برای اتصال برنامهٔ Authenticator" width={240} height={240} />
            <code className="admKey" dir="ltr">{qr.secret}</code>
            <Field label="کد ۶ رقمی">{(p) => <input {...p} {...ltr} inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={form.code} onChange={onCode} required />}</Field>
            {error ? <p className="admError" role="alert">{error}</p> : null}
            <Button type="submit" disabled={busy}>{busy ? "در حال بررسی…" : "فعال‌سازی و ورود"}</Button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
