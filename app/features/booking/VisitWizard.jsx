"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarCheck, CalendarX, Check, ChevronRight, Info } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { PlanList, TimesList } from "./visitBookerParts";
import { MAX_VISIT_SERVICES, clockText, visitSummaryText } from "./visitBookerModel";

const STEPS = ["who", "services", "day", "time", "confirm"];

const COPY = {
  who: { title: "نوبت برای کیه؟", hint: "" },
  services: { title: "چه کاری؟", hint: "یکی یا چندتا؛ به همین ترتیب انجام می‌شن." },
  day: { title: "چه روزی؟", hint: "" },
  time: { title: "ساعت چند؟", hint: "" },
  confirm: { title: "همه‌چی آماده‌ست", hint: "" }
};

/**
 * The days again, as one sideways row above the hours: switching day stays on the hours step.
 * The chosen day scrolls into view when the step opens.
 */
function DayRail({ days, value, onPick }) {
  const railRef = useRef(null);
  useEffect(() => {
    railRef.current?.querySelector(".is-on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);
  return (
    <div className="vbDayRail" ref={railRef} role="group" aria-label="روز">
      {days.map((item) => (
        <button
          type="button"
          key={item.value}
          aria-pressed={value === item.value}
          aria-disabled={item.closed || undefined}
          className={`vbDay${value === item.value ? " is-on" : ""}${item.closed ? " is-closed" : ""}`}
          onClick={() => {
            if (!item.closed && item.value !== value) onPick(item.value);
          }}
        >
          {item.label}
          {item.closed ? <small>تعطیل</small> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * The salon's and the artist's booking form, one question at a time: the question sits in the middle
 * of the screen, and once it is answered it shrinks to a chip at the top (tap it to change it) and the
 * next question comes up. The day and the hour move on by themselves when tapped (on the hour step the
 * days stay in a row above the hours, to switch day without going back); the name and the
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
  // The chosen day has no free hour for these services: say so, and offer the way out right there.
  const noTimes = current === "time" && state.times.status === "ready" && !state.times.list.length;
  const question = noTimes ? "ساعت خالی نداره" : COPY[current].title;

  const typed = state.name.trim();
  // One chip per name a customer is known by (a number can carry several), so typing either finds the person.
  const suggestions = (Array.isArray(customers) ? customers : [])
    .flatMap((item) => (item?.names?.length ? item.names.map((entry) => ({ key: `${item.key}|${entry.key}`, name: entry.name, phone: item.phone })) : item?.name ? [{ key: item.key, name: item.name, phone: item.phone }] : []))
    .filter((item) => !typed || (item.name.includes(typed) && item.name !== typed))
    .slice(0, 4);

  function go(next) {
    setNameHint("");
    setStep(next);
  }

  function next() {
    if (current === "who") {
      if (!hasName) {
        setNameHint("اسم مشتری رو بنویس.");
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
  if (index > 0) done.push({ id: "who", caption: "مشتری", value: [state.name.trim(), state.phone].filter(Boolean).join("، ") });
  if (index > 1) done.push({ id: "services", caption: "خدمت", value: state.picked.map((item) => item.name).join("، ") });
  // On the hour step the days sit in their own row above the hours, so the day chip waits until after.
  if (index > 3 && day) done.push({ id: "day", caption: "روز", value: day.label });
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
          <h3 id="vb-question" className="vbQuestion">{question}</h3>
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
                placeholder="اسم مشتری"
                aria-label="اسم مشتری"
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
                placeholder="موبایل (اگه داری)"
                aria-label="شماره موبایل"
                inputMode="tel"
                enterKeyHint="next"
                autoComplete="off"
                dir="ltr"
                maxLength={13}
              />
              <p className="vbPhoneNote"><Info size={15} aria-hidden="true" /><span>شماره‌ش رو بزن تا یادآوری براش پیامک بشه؛ دیگه لازم نیست خودت پیام بدی.
                {!String(state.phone || "").trim() ? <><br /><strong>بدون شماره هم می‌شه، فقط یادآوری نمی‌ره.</strong></> : null}
              </span></p>
              {suggestions.length ? (
                <div className="vbChips vbSuggest" role="group" aria-label="مشتری‌های قبلی">
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
              <div className="vbPick" role="group" aria-label="خدمت‌ها؛ به همین ترتیب انجام می‌شن">
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
                {state.limitHit ? `حداکثر ${toPersianDigits(MAX_VISIT_SERVICES)} کار توی یه نوبت.` : visitSummaryText(state.picked)}
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
              <DayRail days={days} value={state.day} onPick={(value) => controller.setDay(value)} />
              {noTimes ? (
                <div className="vbNoTimes">
                  <span className="vbNoTimesIcon"><CalendarX size={26} aria-hidden="true" /></span>
                  <p>
                    {day ? `${day.label}` : "این روز"} برای {state.picked.length > 1 ? "این چند کارِ پشت‌سرهم" : "این کار"} ساعت خالی نداره.
                  </p>
                  <button type="button" className="vbSubmit" onClick={() => go("day")}>
                    یه روز دیگه
                  </button>
                  <button type="button" className="vbLink" onClick={() => go("services")}>
                    {state.picked.length > 1 ? "کمترش کن یا عوضش کن" : "یه کار دیگه"}
                  </button>
                </div>
              ) : (
                <TimesList
                  state={state}
                  role={role}
                  onPick={(time) => { controller.setTime(time); go("confirm"); }}
                  onRetry={() => controller.retryTimes()}
                />
              )}
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
