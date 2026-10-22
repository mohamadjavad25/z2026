"use client";

import { useState } from "react";
import { ChevronDown, RotateCw } from "lucide-react";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { clockText } from "./visitBookerModel";

/** A tel: link target from a number as the salon typed it (any digits, spaces, dashes). */
const telHref = (phone) => `tel:${toLatinDigits(String(phone || "")).replace(/[^\d+]/g, "")}`;

/**
 * What the client's form says when the chosen day has no free hour (owner's decisions 2026-10-22): the first free
 * hour found ahead with a button to go there, or that nothing is free for two weeks with a call button when the
 * salon's number is shown.
 */
function AheadNotice({ ahead, phone, onAhead }) {
  if (!ahead) return null;
  if (ahead.status === "loading") return <p className="vbInfo" role="status">در حال پیدا کردن اولین ساعت خالی…</p>;
  if (ahead.status === "found") {
    return (
      <div className="vbInfo vbAhead" role="status">
        <span>اولین ساعت خالی: {ahead.label} {clockText(ahead.time)}</span>
        <button type="button" className="vbAction" onClick={onAhead}>برو به آن روز</button>
      </div>
    );
  }
  return (
    <div className="vbInfo vbAhead" role="status">
      <span>تا دو هفته آینده جا نیست. به سالن پیام بده</span>
      {phone ? <a className="vbAction" href={telHref(phone)}>تماس</a> : null}
    </div>
  );
}

export function TimesList({ state, role, onPick, onRetry, onAhead, onChain, phone }) {
  const { times } = state;
  const isClient = role === "client";
  const group = isClient && state.people > 1;
  const together = group && !state.chain;
  const peopleText = toPersianDigits(state.people);
  if (!state.picked.length) return <p className="vbInfo">اول خدمت را انتخاب کن تا ساعت‌های خالی را ببینی.</p>;
  if (times.status === "loading" || times.status === "idle") return <p className="vbInfo" role="status">در حال پیدا کردن ساعت‌های آزاد…</p>;
  if (times.status === "closed") {
    return <p className="vbInfo" role="status">این روز سالن تعطیل است.{times.closedNext ? ` روز بعد باز: ${times.closedNext}.` : ""}</p>;
  }
  if (times.status === "error") {
    return (
      <div className="vbInfo is-error" role="alert">
        ساعت‌های آزاد بارگیری نشد.
        <button type="button" className="vbLink" onClick={onRetry}><RotateCw size={14} aria-hidden="true" /> دوباره امتحان کن</button>
      </div>
    );
  }
  if (!times.list.length) {
    if (together) {
      return (
        <>
          <div className="vbInfo vbAhead" role="status">
            <span>برای {peopleText} نفر در این روز ساعت مشترک نیست. می‌خواهی {state.people === 2 ? "دو" : peopleText} نوبت پشت‌سرهم بگیری؟</span>
            <button type="button" className="vbAction" onClick={onChain}>آره، پشت‌سرهم</button>
          </div>
          <AheadNotice ahead={times.ahead} phone={phone} onAhead={onAhead} />
        </>
      );
    }
    return (
      <>
        <p className="vbInfo" role="status">
          {state.picked.length > 1 || (group && state.chain)
            ? "این روز ساعتی نیست که همهٔ این خدمت‌ها پشت‌سرهم جا شوند. روز دیگری را انتخاب کن."
            : role === "artist" ? "برای این روز ساعت آزادی با این مدت‌زمان نیست." : "برای این روز ساعتی آزاد نیست. روز دیگری را انتخاب کن."}
        </p>
        {isClient ? <AheadNotice ahead={times.ahead} phone={phone} onAhead={onAhead} /> : null}
      </>
    );
  }
  return (
    <>
      {times.note === "advanced" ? <p className="vbNote" role="status">روزِ قبلی ساعت خالی نداشت؛ نزدیک‌ترین روزِ آزاد را باز کردیم.</p> : null}
      {together ? <p className="vbNote" role="status">ساعت‌هایی که برای {peopleText} نفر با هم جا دارد</p> : null}
      {group && state.chain ? <p className="vbNote" role="status">{peopleText} نفر پشت‌سرهم، یکی بعد از دیگری</p> : null}
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
            <span className="vbPlanService">{state.people > 1 && !state.chain ? `نفر ${toPersianDigits((part.person || 0) + 1)} · ` : ""}{part.service}</span>
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
