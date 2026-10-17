"use client";

import { useRef, useState } from "react";
import { ArrowLeft, CalendarCheck, Check, ChevronRight } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { PlanList, TimesList } from "./visitBookerParts";
import { MAX_VISIT_SERVICES, clockText, visitSummaryText } from "./visitBookerModel";

const STEPS = ["who", "services", "day", "time", "confirm"];

const COPY = {
  who: { title: "مشتری کیست؟", hint: "فقط نام کافی است؛ شمارهٔ موبایل اختیاری است." },
  services: { title: "چه خدمتی انجام می‌شود؟", hint: "یک یا چند خدمت؛ به همان ترتیبی که انتخاب می‌کنی انجام می‌شوند." },
  day: { title: "کدام روز؟", hint: "" },
  time: { title: "ساعت چند؟", hint: "" },
  confirm: { title: "همه‌چیز آماده است", hint: "" }
};

/**
 * The salon's and the artist's booking form, one question at a time: the question sits in the middle
 * of the screen, and once it is answered it shrinks to a chip at the top (tap it to change it) and the
 * next question comes up. The day and the hour move on by themselves when tapped; the name and the
 * services ask for «ادامه» because they can be more than one tap.
 *
 * It only draws what the controller already knows (see visitBookerController.js): the same rules,
 * the same answers, the same save; only the order in which they are asked is new.
 */
export function VisitWizard({ role, title, state, controller, services, days, customers, copy, hint, label, onClose, onSave }) {
  // A customer who is already known (opened from their page) skips the first question.
  const [step, setStep] = useState(() => (state.name.trim() ? "services" : "who"));
  const [nameHint, setNameHint] = useState("");
  const phoneRef = useRef(null);
  const nameRef = useRef(null);

  const { readiness } = state;
  // The hour can vanish while the person is on the last step (someone else took it): go back and ask again.
  const current = step === "confirm" && !state.time ? "time" : step;
  const index = STEPS.indexOf(current);
  const day = days.find((item) => item.value === state.day);
  const hasName = Boolean(state.name.trim());

  const typed = state.name.trim();
  const suggestions = (Array.isArray(customers) ? customers : [])
    .filter((item) => item?.name && (!typed || (item.name.includes(typed) && item.name !== typed)))
    .slice(0, 4);

  function go(next) {
    setNameHint("");
    setStep(next);
  }

  function next() {
    if (current === "who") {
      if (!hasName) {
        setNameHint("نام مشتری را بنویس.");
        nameRef.current?.focus();
        return;
      }
      go("services");
    } else if (current === "services") {
      if (!state.selected.length) return;
      go("day");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (current === "confirm") onSave(event);
    else next();
  }

  // What was answered so far, in the order it was asked.
  const done = [];
  if (index > 0) done.push({ id: "who", caption: "مشتری", value: [state.name.trim(), state.phone].filter(Boolean).join(" · ") });
  if (index > 1) done.push({ id: "services", caption: "خدمت", value: state.picked.map((item) => item.name).join("، ") });
  if (index > 2 && day) done.push({ id: "day", caption: "روز", value: day.label });
  if (index > 3 && state.time) done.push({ id: "time", caption: "ساعت", value: clockText(state.time) });

  const showButton = current === "who" || current === "services" || current === "confirm";
  const needsInput = (current === "who" && !hasName) || (current === "services" && !state.selected.length);
  let buttonLabel = "ادامه";
  if (current === "confirm") buttonLabel = label;

  return (
    <form className={`vb vbWizard is-${role}`} onSubmit={handleSubmit} noValidate aria-label={title}>
      <header className="vbHead vbWizardHead">
        <button
          type="button"
          className="vbBack"
          aria-label={index === 0 ? "بستن" : "مرحلهٔ قبل"}
          onClick={() => (index === 0 ? onClose?.() : go(STEPS[index - 1]))}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
        <h2>{title}</h2>
        <ol className="vbSteps" aria-label={`مرحلهٔ ${toPersianDigits(index + 1)} از ${toPersianDigits(STEPS.length)}`}>
          {STEPS.map((id, position) => (
            <li key={id} className={position < index ? "is-done" : position === index ? "is-now" : ""} />
          ))}
        </ol>
      </header>

      <div className="vbBody is-wizard">
        {done.length ? (
          <div className="vbDoneRow" role="group" aria-label="پاسخ‌های قبلی؛ برای تغییر بزن">
            {done.map((item) => (
              <button type="button" key={item.id} className="vbDoneChip" onClick={() => go(item.id)} aria-label={`${item.caption}: ${item.value}. تغییر`}>
                <small>{item.caption}</small>
                <b>{item.value}</b>
              </button>
            ))}
          </div>
        ) : null}

        <section className="vbStage" key={current} aria-labelledby="vb-question">
          <h3 id="vb-question" className="vbQuestion">{COPY[current].title}</h3>
          {COPY[current].hint ? <p className="vbQuestionHint">{COPY[current].hint}</p> : null}

          {current === "who" ? (
            <div className="vbAsk">
              <input
                id="vb-name"
                ref={nameRef}
                className="vbBig"
                value={state.name}
                onChange={(event) => { setNameHint(""); controller.setName(event.target.value); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (hasName) phoneRef.current?.focus();
                    else next();
                  }
                }}
                placeholder="نام مشتری"
                aria-label="نام مشتری"
                autoComplete="off"
                autoFocus
                maxLength={120}
                required
              />
              <input
                id="vb-phone"
                ref={phoneRef}
                className="vbBig"
                value={state.phone}
                onChange={(event) => controller.setPhone(toLatinDigits(event.target.value).replace(/[^\d+]/g, ""))}
                placeholder="موبایل (اختیاری)"
                aria-label="شماره تماس"
                inputMode="tel"
                enterKeyHint="next"
                autoComplete="off"
                dir="ltr"
                maxLength={13}
              />
              {suggestions.length ? (
                <div className="vbChips vbSuggest" role="group" aria-label="مشتریان قبلی">
                  {suggestions.map((item) => (
                    <button
                      type="button"
                      key={item.key || `${item.name}-${item.phone}`}
                      className="vbPerson"
                      onClick={() => { controller.setName(item.name); controller.setPhone(toLatinDigits(item.phone || "")); setNameHint(""); go("services"); }}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {nameHint ? <p className="vbHint" role="alert">{nameHint}</p> : null}
            </div>
          ) : null}

          {current === "services" ? (
            <div className="vbAsk">
              <div className="vbPick" role="group" aria-label="خدمت‌ها؛ به ترتیبی که انتخاب می‌کنی انجام می‌شوند">
                {services.map((service) => {
                  const order = state.selected.indexOf(service.key);
                  const on = order >= 0;
                  return (
                    <button
                      type="button"
                      key={service.key}
                      className={`vbService vbBigChoice${on ? " is-on" : ""}`}
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
                {state.limitHit ? `حداکثر ${toPersianDigits(MAX_VISIT_SERVICES)} خدمت در یک نوبت.` : visitSummaryText(state.picked)}
              </p>
            </div>
          ) : null}

          {current === "day" ? (
            <div className="vbAsk">
              <div className="vbPick is-days" role="group" aria-label="روز">
                {days.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    aria-pressed={state.day === item.value}
                    aria-disabled={item.closed || undefined}
                    className={`vbDay vbBigChoice${state.day === item.value ? " is-on" : ""}${item.closed ? " is-closed" : ""}`}
                    onClick={() => {
                      if (item.closed) return;
                      controller.setDay(item.value);
                      go("time");
                    }}
                  >
                    {item.label}
                    {item.closed ? <small>تعطیل</small> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {current === "time" ? (
            <div className="vbAsk">
              <TimesList
                state={state}
                role={role}
                onPick={(time) => { controller.setTime(time); go("confirm"); }}
                onRetry={() => controller.retryTimes()}
              />
            </div>
          ) : null}

          {current === "confirm" ? (
            <div className="vbAsk" aria-live="polite">
              <p className="vbSummary is-center">{visitSummaryText(state.picked)}</p>
              <div className="vbPlanSection">
                <PlanList role={role} state={state} onStaff={(position, name) => controller.setStaff(position, name)} onRetry={() => controller.retryPlan()} />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <footer className="vbFoot">
        {hint ? <p className="vbHint" role="alert">{hint}</p> : null}
        {showButton ? (
          <button
            type="submit"
            className={`vbSubmit${current === "confirm" ? (readiness.ok ? "" : " is-incomplete") : needsInput ? " is-incomplete" : ""}`}
            disabled={state.submitting}
            aria-disabled={(current === "confirm" ? !readiness.ok : needsInput) || undefined}
          >
            {current === "confirm" ? <CalendarCheck size={18} aria-hidden="true" /> : null}
            {buttonLabel}
            {current === "confirm" ? null : <ArrowLeft size={18} aria-hidden="true" />}
          </button>
        ) : null}
      </footer>
    </form>
  );
}
