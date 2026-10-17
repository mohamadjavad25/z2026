"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CircleAlert, Hourglass, TriangleAlert, X } from "lucide-react";
import { bannerView } from "./billingView";
import { openPaymentResult, openPlans, useBilling } from "./billingStore";

const DISMISS_KEY = "frfro-billing-banner";
const ICON = { info: CalendarClock, warn: TriangleAlert, danger: CircleAlert };

/** A closed bar stays closed for its situation; a warning or a closed account comes back the next day. */
function storageKey(view) {
  return view.tone === "warn" || view.tone === "danger" ? `${view.key}-${new Date().toDateString()}` : view.key;
}

/**
 * The line at the top of a salon's or artist's own page, only when the subscription needs them: a payment being
 * checked, five days or fewer left, grace days, or a closed account. One tap opens the plans (or the result).
 */
export function BillingBanner() {
  const { overview } = useBilling();
  const view = bannerView(overview);
  const [dismissed, setDismissed] = useState("");
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) || "");
    } catch {
      // storage blocked: the bar simply shows
    }
  }, []);
  if (!view || dismissed === storageKey(view)) return null;

  function close() {
    const key = storageKey(view);
    setDismissed(key);
    try {
      window.localStorage.setItem(DISMISS_KEY, key);
    } catch {
      // not essential
    }
  }
  const Icon = view.kind === "result" ? Hourglass : ICON[view.tone] || CalendarClock;
  return (
    <div className={`billBanner is-${view.tone}`} role="status">
      <Icon size={18} aria-hidden="true" className="billBannerIcon" />
      <p>{view.text}</p>
      <button type="button" className="billBannerAction" onClick={() => (view.kind === "result" ? openPaymentResult(view.paymentId) : openPlans())}>
        {view.action}
      </button>
      {view.kind === "result" ? null : (
        <button type="button" className="billBannerClose" aria-label="بستن یادآوری اشتراک" onClick={close}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
