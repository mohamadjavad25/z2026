"use client";

import { useState } from "react";
import { ChevronDown, RotateCw } from "lucide-react";
import { toLatinDigits } from "../../shared/lib/digits";
import { clockText } from "./visitBookerModel";

export function TimesList({ state, role, onPick, onRetry }) {
  const { times } = state;
  if (!state.picked.length) return <p className="vbInfo">اول خدمت را انتخاب کن تا ساعت‌های خالی را ببینی.</p>;
  if (times.status === "loading" || times.status === "idle") return <p className="vbInfo" role="status">در حال پیدا کردن ساعت‌های آزاد…</p>;
  if (times.status === "error") {
    return (
      <div className="vbInfo is-error" role="alert">
        ساعت‌های آزاد بارگیری نشد.
        <button type="button" className="vbLink" onClick={onRetry}><RotateCw size={14} aria-hidden="true" /> دوباره امتحان کن</button>
      </div>
    );
  }
  if (!times.list.length) {
    return (
      <p className="vbInfo" role="status">
        {state.picked.length > 1
          ? "این روز ساعتی نیست که همهٔ این خدمت‌ها پشت‌سرهم جا شوند. روز دیگری را انتخاب کن."
          : role === "artist" ? "برای این روز ساعت آزادی با این مدت‌زمان نیست." : "برای این روز ساعتی آزاد نیست. روز دیگری را انتخاب کن."}
      </p>
    );
  }
  return (
    <>
      {times.note === "advanced" ? <p className="vbNote" role="status">روزِ قبلی ساعت خالی نداشت؛ نزدیک‌ترین روزِ آزاد را باز کردیم.</p> : null}
      <div className="vbTimes" role="group" aria-label="ساعت شروع">
        {times.list.map((time) => {
          const on = state.time && toLatinDigits(time) === toLatinDigits(state.time);
          return (
            <button type="button" key={time} aria-pressed={Boolean(on)} className={`vbTime${on ? " is-on" : ""}`} onClick={() => onPick(time)}>
              {clockText(time)}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function PlanList({ role, state, onStaff, onRetry }) {
  const { plan } = state;
  const [openIndex, setOpenIndex] = useState(-1);
  // A new time or other services is a new plan: any open artist list is for the old one.
  const planKey = `${state.time}|${state.selected.join(",")}`;
  const [seenKey, setSeenKey] = useState(planKey);
  if (seenKey !== planKey) {
    setSeenKey(planKey);
    setOpenIndex(-1);
  }
  const parts = plan.parts || [];
  if (plan.status === "error") {
    return (
      <div className="vbInfo is-error" role="alert">
        نتوانستیم این ساعت را بررسی کنیم.
        <button type="button" className="vbLink" onClick={onRetry}><RotateCw size={14} aria-hidden="true" /> دوباره امتحان کن</button>
      </div>
    );
  }
  if (!parts.length) {
    return plan.status === "loading" ? <p className="vbInfo" role="status">در حال بررسی…</p> : null;
  }
  const canPick = role === "salon";
  return (
    <ol className={`vbPlan${plan.status === "loading" ? " is-loading" : ""}`}>
      {parts.map((part, index) => {
        const options = Array.isArray(part.options) ? part.options : [];
        const pickable = canPick && options.length > 0;
        const expanded = pickable && openIndex === index;
        const problem = plan.status === "problem" && plan.partIndex === index;
        return (
          <li key={`${part.service}-${index}`} className={`vbPlanRow${problem ? " has-problem" : ""}`}>
            <span className="vbPlanTime">{clockText(part.start)}–{clockText(part.end)}</span>
            <span className="vbPlanService">{part.service}</span>
            {role === "artist" ? null : pickable ? (
              <button
                type="button"
                className="vbWho2"
                aria-expanded={expanded}
                aria-label={`آرتیست ${part.service}: ${part.staff || "تعیین نشده"}. تغییر`}
                onClick={() => setOpenIndex(expanded ? -1 : index)}
              >
                {part.staff || "تعیین نشده"}
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            ) : (
              <span className="vbWho2 is-static">{part.staff || "—"}</span>
            )}
            {expanded ? (
              <div className="vbStaffList" role="group" aria-label={`آرتیست ${part.service}`}>
                <button
                  type="button"
                  aria-pressed={!state.staff[index]}
                  className={`vbStaff${!state.staff[index] ? " is-on" : ""}`}
                  onClick={() => { onStaff(index, ""); setOpenIndex(-1); }}
                >
                  انتخاب خودکار
                </button>
                {options.map((option) => {
                  const unavailable = Boolean(option.away) || !option.free;
                  const on = state.staff[index] === option.name;
                  return (
                    <button
                      type="button"
                      key={option.name}
                      aria-pressed={on}
                      aria-disabled={unavailable || undefined}
                      className={`vbStaff${on ? " is-on" : ""}${unavailable ? " is-off" : ""}`}
                      onClick={() => { if (unavailable) return; onStaff(index, option.name); setOpenIndex(-1); }}
                    >
                      {option.name}
                      <small>{option.away || (!option.free ? "مشغول" : option.skilled ? "" : "تخصص دیگر")}</small>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {problem && plan.message ? <p className="vbPlanProblem">{plan.message}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
