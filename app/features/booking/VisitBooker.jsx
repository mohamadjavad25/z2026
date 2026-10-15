"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CalendarCheck, Check, ChevronDown, Plus, RotateCw } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { createVisitBookerController } from "./visitBookerController";
import { MAX_VISIT_SERVICES, clockText, missingText, visitSummaryText } from "./visitBookerModel";

const ROLE_COPY = {
  client: { submit: "ارسال درخواست", busy: "در حال ارسال…" },
  salon: { submit: "ثبت رزرو", busy: "در حال ثبت…" },
  artist: { submit: "ثبت رزرو", busy: "در حال ثبت…" }
};

/**
 * One form to book one or several services, for a client asking a salon (`role="client"`), a salon
 * entering its own customer (`"salon"`) and an independent artist doing the same (`"artist"`). The
 * layers differ only where the job differs: who the customer is, whether the plan (who does what)
 * can be changed, and whether the booking is a request or settled. See docs/VISIT_BOOKER.md.
 *
 * It is a full-screen sheet with no close button (the phone's back button closes it). The free
 * times and the plan come from `source` (see visitBookerController.js); `onSubmit(body)` sends the
 * booking and resolves { ok, status, payload }; `onDone(result)` runs once it went through.
 */
export function VisitBooker({
  open,
  role,
  title,
  subtitle = "",
  services,
  days,
  initial,
  customers = [],
  source,
  onSubmit,
  onDone,
  onClose,
  onAddService,
  onEditProfile
}) {
  return (
    <ProfileSheet
      open={open}
      hideHeader
      hideClose
      label={title}
      panelClassName="visitBookerSheet"
      onClose={onClose}
    >
      <VisitBookerForm
        role={role}
        title={title}
        subtitle={subtitle}
        services={services}
        days={days}
        initial={initial}
        customers={customers}
        source={source}
        onSubmit={onSubmit}
        onDone={onDone}
        onAddService={onAddService}
        onEditProfile={onEditProfile}
      />
    </ProfileSheet>
  );
}

function VisitBookerForm({ role, title, subtitle, services, days, initial, customers, source, onSubmit, onDone, onAddService, onEditProfile }) {
  // The controller lives as long as the sheet is open; what the parent passes later (fresh lists,
  // new closures) is read through refs so it never has to be recreated.
  const latest = useRef({});
  latest.current = { source, onSubmit, onDone };
  // The services and days as they were when the sheet opened: the person is mid-booking, so the
  // list does not shift under them (the server still checks everything when it is sent).
  const [frozen] = useState(() => ({ services, days, initial }));
  const controller = useMemo(() => createVisitBookerController({
    role,
    services: frozen.services,
    days: frozen.days,
    initial: frozen.initial,
    source: {
      loadTimes: (query) => latest.current.source.loadTimes(query),
      ...(source.loadPlan ? { loadPlan: (query) => latest.current.source.loadPlan(query) } : {})
    },
    submit: (body) => latest.current.onSubmit(body)
    // Created once per opening of the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  useEffect(() => {
    controller.start();
    return () => controller.dispose();
  }, [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  // Tell the parent once, when the booking is in.
  const told = useRef(false);
  useEffect(() => {
    if (state.done && !told.current) {
      told.current = true;
      latest.current.onDone?.(state);
    }
  }, [state]);

  const { services: frozenServices, days: frozenDays } = frozen;
  const copy = ROLE_COPY[role] || ROLE_COPY.salon;
  const day = frozenDays.find((item) => item.value === state.day);
  const summary = visitSummaryText(state.picked);
  const { readiness } = state;
  const checking = readiness.reason === "checking";
  const phoneMissing = role === "client" && !String(state.phone || "").trim();
  // Earlier customers matching what is typed, one tap to fill in name and number (salon and artist only).
  const typed = state.name.trim();
  const suggestions = role === "client" ? [] : (Array.isArray(customers) ? customers : [])
    .filter((item) => item?.name && (!typed || (item.name.includes(typed) && item.name !== typed)))
    .slice(0, 4);

  // What to say above the button, most important first.
  let hint = "";
  if (state.error) hint = state.error;
  // A problem with one service is written on its row; the rest are said here.
  else if (readiness.reason === "problem" && !(state.plan.partIndex >= 0)) hint = readiness.message || "این زمان برای این نوبت جا ندارد؛ ساعت دیگری را انتخاب کن.";
  else if (state.tried && readiness.reason === "missing") hint = missingText(readiness.missing);

  function handleSubmit(event) {
    event.preventDefault();
    void controller.submit().then((result) => {
      if (result?.ok || result?.reason !== "missing") return;
      // Take the person to the first thing that is missing.
      const target = result.missing?.[0] === "نام مشتری" ? "#vb-name" : result.missing?.[0] === "شماره تماس" ? "#vb-phone" : result.missing?.[0] === "خدمت" ? ".vbService" : ".vbTime";
      document.querySelector(`.visitBookerSheet ${target}`)?.focus?.();
    });
  }

  let label = copy.submit;
  if (state.submitting) label = copy.busy;
  else if (checking) label = "در حال بررسی…";
  else if (readiness.ok && day) label = `${copy.submit} · ${day.label} ${clockText(state.time)}`;

  return (
    <form className={`vb is-${role}`} onSubmit={handleSubmit} noValidate aria-label={title}>
      <header className="vbHead">
        <h2>{title}</h2>
        {subtitle ? <small>{subtitle}</small> : null}
      </header>

      <div className="vbBody">
        {role === "client" ? (
          // The client's own name and number are already known; the card shows only to ask for a missing number.
          phoneMissing ? (
            <section className="vbWho is-readonly" aria-label="اطلاعات تماس">
              <span><small>شماره تماس</small><b dir="ltr">ثبت نشده</b></span>
              {typeof onEditProfile === "function" ? (
                <button type="button" className="vbLink" onClick={onEditProfile}>ثبت شماره تماس</button>
              ) : null}
            </section>
          ) : null
        ) : (
          <section className="vbWho" aria-label="مشتری">
            <input
              id="vb-name"
              value={state.name}
              onChange={(event) => controller.setName(event.target.value)}
              placeholder="نام مشتری"
              aria-label="نام مشتری"
              autoComplete="off"
              maxLength={120}
              required
            />
            <input
              id="vb-phone"
              value={state.phone}
              onChange={(event) => controller.setPhone(toLatinDigits(event.target.value).replace(/[^\d+]/g, ""))}
              placeholder="موبایل (اختیاری)"
              aria-label="شماره تماس"
              inputMode="tel"
              autoComplete="off"
              dir="ltr"
              maxLength={13}
            />
          </section>
        )}
        {suggestions.length ? (
          <div className="vbChips vbSuggest" role="group" aria-label="مشتریان قبلی">
            {suggestions.map((item) => (
              <button
                type="button"
                key={item.key || `${item.name}-${item.phone}`}
                className="vbPerson"
                onClick={() => { controller.setName(item.name); controller.setPhone(toLatinDigits(item.phone || "")); }}
              >
                {item.name}
              </button>
            ))}
          </div>
        ) : null}

        <section className="vbSection" aria-label="خدمت‌ها">
          {frozenServices.length ? (
            <>
              <div className="vbChips" role="group" aria-label="خدمت‌ها؛ به ترتیبی که انتخاب می‌کنی انجام می‌شوند">
                {frozenServices.map((service) => {
                  const order = state.selected.indexOf(service.key);
                  const on = order >= 0;
                  return (
                    <button
                      type="button"
                      key={service.key}
                      className={`vbService${on ? " is-on" : ""}`}
                      aria-pressed={on}
                      onClick={() => controller.toggleService(service.key)}
                    >
                      <ServiceIcon emoji={service.emoji} name={service.name} size="xs" />
                      <span>{service.name}</span>
                      {on && state.selected.length > 1 ? <i>{toPersianDigits(order + 1)}</i> : null}
                      {on && state.selected.length < 2 ? <Check size={14} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
              <p className="vbSummary" aria-live="polite">
                {state.limitHit
                  ? `حداکثر ${toPersianDigits(MAX_VISIT_SERVICES)} خدمت در یک نوبت.`
                  : summary || "یک یا چند خدمت را انتخاب کن."}
              </p>
            </>
          ) : (
            <button type="button" className="vbEmpty" onClick={onAddService}>
              <Plus size={16} aria-hidden="true" />
              هنوز خدمتی نداری؛ اولین خدمت را اضافه کن
            </button>
          )}
        </section>

        <section className="vbSection" aria-label="روز">
          <div className="vbChips" role="group" aria-label="روز">
            {frozenDays.map((item) => (
              <button
                type="button"
                key={item.value}
                aria-pressed={state.day === item.value}
                aria-disabled={item.closed || undefined}
                className={`vbDay${state.day === item.value ? " is-on" : ""}${item.closed ? " is-closed" : ""}`}
                onClick={() => controller.setDay(item.value)}
              >
                {item.label}
                {item.closed ? <small>تعطیل</small> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="vbSection vbTimesSection" aria-label="ساعت">
          <TimesList state={state} role={role} onPick={(time) => controller.setTime(time)} onRetry={() => controller.retryTimes()} />
        </section>

        {state.time ? (
          <section className="vbSection vbPlanSection" aria-label="برنامهٔ نوبت" aria-live="polite">
            <PlanList role={role} state={state} onStaff={(index, name) => controller.setStaff(index, name)} onRetry={() => controller.retryPlan()} />
            {role === "client" && state.plan.status === "ok" && state.plan.parts.length > 1 ? (
              <p className="vbPlanNote">آرتیست‌ها پیشنهاد سالن‌اند و ممکن است سالن عوضشان کند. اگر ساعت را عوض کند، اول از تو می‌پرسد.</p>
            ) : null}
          </section>
        ) : null}
      </div>

      <footer className="vbFoot">
        {hint ? <p className="vbHint" role="alert">{hint}</p> : null}
        <button
          type="submit"
          className={`vbSubmit${readiness.ok ? "" : " is-incomplete"}`}
          disabled={state.submitting}
          aria-disabled={!readiness.ok || undefined}
        >
          <CalendarCheck size={18} aria-hidden="true" />
          {label}
        </button>
      </footer>
    </form>
  );
}

function TimesList({ state, role, onPick, onRetry }) {
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

function PlanList({ role, state, onStaff, onRetry }) {
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
