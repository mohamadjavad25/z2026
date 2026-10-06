"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../shared/api/client";
import { Button, Field } from "../components/ui";
import { registerStepUp } from "./adminFetch";

/** Asks the admin to re-type their password before a dangerous action; resolves the pending adminFetch call. */
export function StepUpDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);

  useEffect(
    () =>
      registerStepUp(
        () =>
          new Promise((resolve) => {
            pending.current = resolve;
            setPassword("");
            setError("");
            setOpen(true);
          })
      ),
    []
  );

  function finish(ok) {
    setOpen(false);
    pending.current?.(ok);
    pending.current = null;
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { ok, payload } = await apiFetch("/api/admin/auth/stepup", { method: "POST", body: JSON.stringify({ password }) });
    setBusy(false);
    if (ok) finish(true);
    else setError(payload.error || "تأیید نشد.");
  }

  if (!open) return null;
  return (
    <div className="admModal" role="dialog" aria-modal="true" aria-label="تأیید دوباره">
      <form className="admCard admForm" onSubmit={submit}>
        <h2>تأیید دوباره</h2>
        <p className="admMuted">این کار حساس است. رمز عبور حساب مدیریتت را دوباره وارد کن (تا ۵ دقیقه بعد لازم نیست دوباره بزنی).</p>
        <Field label="رمز عبور">{(p) => <input {...p} dir="ltr" type="password" autoComplete="current-password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} required />}</Field>
        {error ? <p className="admError" role="alert">{error}</p> : null}
        <Button type="submit" disabled={busy}>{busy ? "در حال بررسی…" : "تأیید"}</Button>
        <button type="button" className="admLink" onClick={() => finish(false)}>انصراف</button>
      </form>
    </div>
  );
}
