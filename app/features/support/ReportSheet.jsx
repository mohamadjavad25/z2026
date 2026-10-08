"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { SupportShell } from "./SupportShell";
import { openSupport } from "./supportEvents";

const REASONS = [
  ["spam", "اسپم یا تبلیغ"],
  ["inappropriate", "محتوای نامناسب"],
  ["fake", "جعلی یا گمراه‌کننده"],
  ["copyright", "کپی از کار دیگران"],
  ["other", "سایر"]
];

/** Report a post (or an account) to the admin. `above` lifts it over the post viewer. */
export function ReportSheet({ targetType = "post", targetId, title = "", above = false, onClose }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null); // the ticket id once sent

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { ok, payload } = await apiFetch("/api/reports", { method: "POST", body: JSON.stringify({ targetType, targetId, reason, note }) });
    setBusy(false);
    if (ok) setSent(payload.data?.id || true);
    else setError(payload.error || "ارسال نشد. دوباره امتحان کن.");
  }

  return (
    <SupportShell title={targetType === "post" ? "گزارش این پست" : "گزارش این حساب"} label="گزارش تخلف" above={above} onClose={onClose}>
      {sent ? (
        <div className="supDone" role="status">
          <CircleCheck size={36} aria-hidden="true" />
          <b>ممنون که گزارش دادی</b>
          <p>گزارشت را بررسی می‌کنیم. هر خبری باشد در بخش پشتیبانی برایت می‌نویسیم.</p>
          <button type="button" className="supBtn" onClick={onClose}>باشه</button>
          {typeof sent === "number" ? <button type="button" className="supLink" onClick={() => { onClose(); openSupport({ ticketId: sent }); }}>دیدن در پشتیبانی</button> : null}
        </div>
      ) : (
        <form onSubmit={submit} className="supForm">
          {title ? <p className="supTarget">«{title}»</p> : null}
          <div className="supChips is-column" role="radiogroup" aria-label="دلیل گزارش">
            {REASONS.map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={reason === value} className={reason === value ? "is-on" : ""} onClick={() => setReason(value)}>{label}</button>
            ))}
          </div>
          <label className="supField">
            <span>توضیح بیشتر (اختیاری)</span>
            <textarea rows={3} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </label>
          {error ? <p className="supError" role="alert">{error}</p> : null}
          <button type="submit" className="supBtn" disabled={busy || !reason}>{busy ? "در حال ارسال…" : "ارسال گزارش"}</button>
        </form>
      )}
    </SupportShell>
  );
}
