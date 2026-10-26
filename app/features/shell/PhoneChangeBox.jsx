"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";

/**
 * «شمارهٔ موبایل» in the profile sheet (owner's decision of 2026-10-25): the number is not a plain field any more.
 * «عوض کن» → the new number → «دریافت کد» (texted to the NEW number) → the code → saved at once. A number that belongs
 * to another account is refused; every other phone signed in to the account is signed out; the old number gets a
 * short SMS. `onChanged(user)` receives the saved account.
 */
export function PhoneChangeBox({ phone = "", onChanged }) {
  const [step, setStep] = useState("idle"); // idle | number | code
  const [nextPhone, setNextPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const reset = () => { setStep("idle"); setNextPhone(""); setCode(""); setProblem(""); };
  const cleanPhone = toLatinDigits(nextPhone).replace(/\D/g, "");

  async function sendCode() {
    if (!/^09\d{9}$/.test(cleanPhone)) {
      setProblem("شمارهٔ تازه رو این‌جوری بزن: ۰۹۱۲۳۴۵۶۷۸۹");
      return;
    }
    setBusy(true);
    setProblem("");
    const { ok, payload } = await apiFetch("/api/auth/otp/send", { method: "POST", body: JSON.stringify({ phone: cleanPhone, purpose: "phone_change" }) })
      .catch(() => ({ ok: false, payload: { error: "اینترنتت وصل نیست؛ دوباره بزن." } }));
    setBusy(false);
    if (!ok) {
      setProblem(payload?.error || "کد نرفت؛ دوباره بزن.");
      return;
    }
    setStep("code");
  }

  async function confirm() {
    const cleanCode = toLatinDigits(code).replace(/\D/g, "");
    if (cleanCode.length !== 5) {
      setProblem("کد ۵ رقمی رو بزن.");
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      const verified = await apiFetch("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone: cleanPhone, code: cleanCode, purpose: "phone_change" }) });
      if (!verified.ok) {
        setProblem(verified.payload?.error || "کد اشتباهه؛ دوباره بزن.");
        return;
      }
      const saved = await apiFetch("/api/profile", { method: "POST", body: JSON.stringify({ data: { phone: cleanPhone, phoneProof: verified.payload?.data?.proof } }) });
      if (!saved.ok) {
        setProblem(saved.payload?.error || "شماره عوض نشد؛ دوباره بزن.");
        return;
      }
      reset();
      onChanged?.(saved.payload?.data?.user);
    } catch {
      setProblem("اینترنتت وصل نیست؛ دوباره بزن.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pePhone">
      <div className="pePhoneRow">
        <span className="pePhoneLabel"><Phone size={15} aria-hidden="true" />شمارهٔ موبایل</span>
        <b dir="ltr">{toPersianDigits(phone) || "—"}</b>
        {step === "idle" ? (
          <button type="button" className="pePhoneBtn" onClick={() => setStep("number")}>عوض کن</button>
        ) : null}
      </div>
      {step === "number" ? (
        <div className="pePhoneStep">
          <label className="peField">
            <span>شمارهٔ تازه</span>
            <input
              id="pe-new-phone"
              value={nextPhone}
              onChange={(event) => setNextPhone(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={11}
              placeholder="09123456789"
            />
          </label>
          <small>کد به شمارهٔ تازه می‌ره. بعد از عوض شدن، بقیهٔ گوشی‌هات از حساب بیرون می‌رن و یه پیامک کوتاه هم به شمارهٔ قبلی می‌ره.</small>
          <div className="pePhoneActions">
            <button type="button" className="pePhoneBtn is-main" disabled={busy} onClick={sendCode}>{busy ? "دارم می‌فرستم…" : "دریافت کد"}</button>
            <button type="button" className="pePhoneBtn" disabled={busy} onClick={reset}>نه</button>
          </div>
        </div>
      ) : null}
      {step === "code" ? (
        <div className="pePhoneStep">
          <label className="peField">
            <span>کدی که به {toPersianDigits(cleanPhone)} اومد</span>
            <input
              id="pe-phone-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={5}
              placeholder="۵ رقم"
            />
          </label>
          <div className="pePhoneActions">
            <button type="button" className="pePhoneBtn is-main" disabled={busy} onClick={confirm}>{busy ? "یه لحظه…" : "تأیید و عوض کن"}</button>
            <button type="button" className="pePhoneBtn" disabled={busy} onClick={() => { setStep("number"); setCode(""); setProblem(""); }}>شماره رو اشتباه زدم</button>
          </div>
        </div>
      ) : null}
      {problem ? <p className="pePhoneProblem" role="alert">{problem}</p> : null}
    </div>
  );
}
