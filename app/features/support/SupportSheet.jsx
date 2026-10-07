"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, X } from "lucide-react";
import { apiFetch } from "../../shared/api/client";

const CATEGORIES = [
  ["question", "سؤال"],
  ["bug", "مشکل فنی"],
  ["account", "مشکل حساب"],
  ["complaint", "شکایت"],
  ["other", "سایر"]
];

/** Shared shell for the small sheets of this feature: portal, Escape, backdrop click, focus on open. */
export function SupportShell({ title, label, above = false, onClose, children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector("form button, form input, form textarea, .supDone button")?.focus();
    // Capture phase + stopPropagation: when opened over the post viewer, Escape closes only this sheet.
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`supOverlay${above ? " is-above" : ""}`} onClick={onClose}>
      <div className="supSheet" role="dialog" aria-modal="true" aria-label={label || title} ref={ref} onClick={(event) => event.stopPropagation()}>
        <header className="supHead">
          <h3>{title}</h3>
          <button type="button" className="supX" onClick={onClose} aria-label="بستن پنجره"><X size={18} aria-hidden="true" /></button>
        </header>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** "Contact support": a short message that lands in the admin's support inbox. */
export function SupportSheet({ onClose }) {
  const [category, setCategory] = useState("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { ok, payload } = await apiFetch("/api/support", { method: "POST", body: JSON.stringify({ category, subject, message }) });
    setBusy(false);
    if (ok) setSent(true);
    else setError(payload.error || "ارسال نشد. دوباره امتحان کن.");
  }

  return (
    <SupportShell title="ارتباط با پشتیبانی" onClose={onClose}>
      {sent ? (
        <div className="supDone" role="status">
          <CircleCheck size={36} aria-hidden="true" />
          <b>پیامت رسید</b>
          <p>به‌زودی بررسی می‌کنیم و اگر لازم شد با شمارهٔ حسابت تماس می‌گیریم.</p>
          <button type="button" className="supBtn" onClick={onClose}>باشه</button>
        </div>
      ) : (
        <form onSubmit={submit} className="supForm">
          <div className="supChips" role="radiogroup" aria-label="موضوع پیام">
            {CATEGORIES.map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={category === value} className={category === value ? "is-on" : ""} onClick={() => setCategory(value)}>{label}</button>
            ))}
          </div>
          <label className="supField">
            <span>عنوان (اختیاری)</span>
            <input type="text" value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="supField">
            <span>پیامت</span>
            <textarea rows={5} value={message} maxLength={2000} required minLength={10} onChange={(event) => setMessage(event.target.value)} placeholder="مشکل یا سؤالت را بنویس…" />
          </label>
          {error ? <p className="supError" role="alert">{error}</p> : null}
          <button type="submit" className="supBtn" disabled={busy || message.trim().length < 10}>{busy ? "در حال ارسال…" : "ارسال پیام"}</button>
        </form>
      )}
    </SupportShell>
  );
}
