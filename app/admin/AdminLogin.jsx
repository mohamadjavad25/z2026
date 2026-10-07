"use client";

import { useState } from "react";
import { apiFetch } from "../shared/api/client";
import { Button, Field } from "../components/ui";

const ltr = { dir: "ltr", autoComplete: "off", autoCapitalize: "off", spellCheck: false };

/** Admin sign-in: phone + password + authenticator code. "First-time setup" links an authenticator app (needs the setup key from the server's env). */
export function AdminLogin({ configured, setupKeyConfigured = true, onDone }) {
  const [mode, setMode] = useState("login"); // login | setup | scan
  const [form, setForm] = useState({ phone: "", password: "", code: "", setupKey: "" });
  const [qr, setQr] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const secretType = reveal ? "text" : "password";
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(path, body, next) {
    setBusy(true);
    setError("");
    const { ok, payload } = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!ok) return setError(payload.error || "ورود انجام نشد.");
    next(payload.data);
  }

  const onLogin = (event) => {
    event.preventDefault();
    submit("/api/admin/auth/login", { phone: form.phone, password: form.password, code: form.code }, onDone);
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
          <p className="admError" role="alert">ورود مدیریت هنوز روی سرور فعال نشده است (متغیر ZIBABAN_ADMIN_SECRET تنظیم نشده).</p>
        </section>
      </main>
    );
  }

  return (
    <main className="adm admLoginWrap">
      <section className="admCard admLogin">
        <h1>ورود مدیریت</h1>
        {mode === "login" ? (
          <form onSubmit={onLogin} className="admForm">
            <Field label="شمارهٔ موبایل">{(p) => <input {...p} {...ltr} inputMode="tel" autoComplete="username" value={form.phone} onChange={set("phone")} required />}</Field>
            <Field label="رمز عبور">{(p) => <input {...p} {...ltr} type={secretType} autoComplete="current-password" value={form.password} onChange={set("password")} required />}</Field>
            <Field label="کد ۶ رقمی برنامهٔ Authenticator">{(p) => <input {...p} {...ltr} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={form.code} onChange={set("code")} required />}</Field>
            {error ? <p className="admError" role="alert">{error}</p> : null}
            <Button type="submit" disabled={busy}>{busy ? "در حال بررسی…" : "ورود"}</Button>
            <div className="admFirstTime">
              <p className="admMuted">اولین بار است؟ هنوز برنامهٔ Authenticator را وصل نکرده‌ای؟</p>
              <Button type="button" variant="secondary" onClick={() => { setError(""); setMode("setup"); }}>راه‌اندازی اولیه (دریافت QR)</Button>
            </div>
          </form>
        ) : null}
        {mode === "setup" ? (
          <form onSubmit={onSetup} className="admForm">
            <p className="admMuted">فقط بار اول لازم است. شماره، رمز و «کلید راه‌اندازی» سرور را وارد کن؛ بعد یک QR می‌بینی که با Google Authenticator یا برنامهٔ مشابه اسکن می‌کنی.</p>
            <Field label="شمارهٔ موبایل">{(p) => <input {...p} {...ltr} inputMode="tel" autoComplete="username" value={form.phone} onChange={set("phone")} required />}</Field>
            <Field label="رمز عبور">{(p) => <input {...p} {...ltr} type={secretType} autoComplete="current-password" value={form.password} onChange={set("password")} required />}</Field>
            <Field label="کلید راه‌اندازی">{(p) => <input {...p} {...ltr} type={secretType} value={form.setupKey} onChange={set("setupKey")} required />}</Field>
            <label className="admReveal"><input type="checkbox" checked={reveal} onChange={(event) => setReveal(event.target.checked)} /> نمایش رمز و کلید هنگام تایپ</label>
            {!setupKeyConfigured ? <p className="admError" role="alert">کلید راه‌اندازی روی سرور تنظیم نشده یا کمتر از ۱۶ نویسه است. در Vercel متغیر ZIBABAN_ADMIN_SETUP_KEY را (حداقل ۱۶ نویسه) بگذار و دوباره Redeploy کن؛ تا آن موقع راه‌اندازی هر ورودی را رد می‌کند.</p> : null}
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
            <Field label="کد ۶ رقمی">{(p) => <input {...p} {...ltr} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={form.code} onChange={set("code")} required />}</Field>
            {error ? <p className="admError" role="alert">{error}</p> : null}
            <Button type="submit" disabled={busy}>{busy ? "در حال بررسی…" : "فعال‌سازی و ورود"}</Button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
