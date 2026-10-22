"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ExitPlanPanel } from "./ExitPlanPanel";
import { onExitDialog } from "./exitDialogBus";

/**
 * The dialog for leaving a team / removing a team member while confirmed bookings exist (owner's rules of 2026-10-22).
 * Mounted once (HomeView); opened through openExitDialog().
 */
export function ProviderExitHost({ onNotice }) {
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => onExitDialog((next) => { setBusy(false); setDetail(next); }), []);

  if (!detail) return null;
  const close = () => setDetail(null);

  const confirm = async ({ cancelAll = false } = {}) => {
    setBusy(true);
    try {
      const result = await detail.retry({ cancelAll });
      if (result?.ok) {
        close();
      } else {
        setDetail((current) => (current ? { ...current, plan: result?.plan || current.plan, message: result?.message || current.message } : current));
      }
    } catch {
      setDetail((current) => (current ? { ...current, message: "انجام نشد؛ اینترنتت را نگاه کن و دوباره امتحان کن." } : current));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pxBackdrop" role="dialog" aria-modal="true" aria-label={detail.title} onClick={close}>
      <div className="pxSheet" onClick={(event) => event.stopPropagation()}>
        <header className="pxHead">
          <b>{detail.title}</b>
          <button type="button" className="pxClose" aria-label="بستن" onClick={close}><X size={18} /></button>
        </header>
        <ExitPlanPanel
          plan={detail.plan}
          scope={detail.scope}
          params={detail.params}
          message={detail.message}
          confirmLabel={detail.confirmLabel}
          busy={busy}
          onPlan={(plan) => setDetail((current) => (current ? { ...current, plan } : current))}
          onConfirm={confirm}
          onNotice={onNotice}
        />
      </div>
    </div>
  );
}
