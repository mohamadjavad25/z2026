"use client";

import { useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { joinWaitlist } from "../../shared/api/waitlist";
import { clockText } from "./visitBookerModel";

/**
 * «خبرم کن» (owner's decision of 2026-10-27): on a day with no free time for what the client picked, they ask to be told
 * when one opens there. `services` is [{ name, minutes }]; `dayLabel` is how the day is said («فردا»).
 * After joining it says so; if a time happened to be free already, it says which.
 */
export function WaitlistButton({ kind, ownerId, day, dayLabel = "", services, placeLabel = "" }) {
  const key = `${kind}|${ownerId}|${day}|${(services || []).map((item) => item.name).join("+")}`;
  const [state, setState] = useState({ key: "", status: "idle", message: "", freeNow: [] });
  const current = state.key === key ? state : { key, status: "idle", message: "", freeNow: [] };
  if (!ownerId || !day || !services?.length) return null;

  const join = async () => {
    setState({ key, status: "busy", message: "", freeNow: [] });
    try {
      const { ok, payload } = await joinWaitlist({ kind, ownerId, day, services });
      if (!ok) {
        setState({ key, status: "error", message: payload?.error || "نشد؛ دوباره بزن.", freeNow: [] });
        return;
      }
      setState({ key, status: "done", message: "", freeNow: payload?.data?.freeNow || [] });
    } catch {
      setState({ key, status: "error", message: "وصل نشد؛ دوباره بزن.", freeNow: [] });
    }
  };

  if (current.status === "done") {
    return (
      <div className="vbWait is-done" role="status">
        <CheckCircle2 size={18} aria-hidden="true" />
        <span>
          {current.freeNow.length
            ? `الان ساعت ${clockText(current.freeNow[0])} خالیه؛ همین روز رو یه بار دیگه بزن.`
            : `باشه! ${dayLabel || "این روز"} اگه ${placeLabel || "اون‌جا"} جا خالی شد، همون لحظه خبرت می‌کنیم.`}
        </span>
      </div>
    );
  }

  return (
    <div className="vbWait" role="group" aria-label="خبرم کن">
      <span>
        <b>پره؟ خبرت می‌کنیم.</b>
        <small>اگه کسی لغو کرد و برای {services.length > 1 ? "این کارها" : "این کار"} جا باز شد، اولین نفرایی هستی که می‌فهمن.</small>
      </span>
      <button type="button" className="vbWaitBtn" disabled={current.status === "busy"} onClick={join}>
        <BellRing size={16} aria-hidden="true" />
        {current.status === "busy" ? "یه لحظه…" : "خبرم کن"}
      </button>
      {current.status === "error" ? <small className="vbWaitError" role="alert">{current.message}</small> : null}
    </div>
  );
}
