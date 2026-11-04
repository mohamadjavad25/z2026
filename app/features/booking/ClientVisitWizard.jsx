"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarCheck, Check, ChevronRight, Users, Zap } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ATTEND_NOTICE } from "../../shared/lib/attendance";
import { PlanList, TimesList } from "./visitBookerParts";
import { WaitChoice } from "./WaitChoice";
import { COUNTED_DAYS, fa, dayShort, dayDate, dayName, minutesText, dayStatus, NoRoom, DayRail, TakenNotice } from "./clientWizardParts";
import { MAX_VISIT_PEOPLE, clockText, maxServicesFor, visitSummaryText, visitTotals } from "./visitBookerModel";

const STEPS = ["services", "day", "time", "confirm"];

/**
 * The client's booking at a salon, one question at a time, like the salon's own form (owner's decision of 2026-11-02, the
 * same for a client in the app and a visitor from an Instagram link): the services (one or several, in order, with
 * «با دوستت میای؟» for a group), the day (each of the next two weeks says how many free times it has), the time, and one
 * last look as a ticket with «بفرست». A tap on a day or a time moves on by itself; the services and the ticket have a
 * button. Answers shrink to chips at the top; a tap on one goes back to it.
 *
 * It only draws what the controller knows (visitBookerController.js): the same rules, the same request.
 */
export function ClientVisitWizard({ title, placeName, state, controller, services, days, contactPhone, withName, waitlist, hint, label, longestDay = 0, startStep = "", onClose, onSave, onEditProfile }) {
  // Services already picked (from the salon's page or a story) start on the day; a request asked again elsewhere, with
  // its day and hour, starts on the ticket.
  const [step, setStep] = useState(() => (STEPS.includes(startStep) ? startStep : state.selected.length ? "day" : "services"));
  const [later, setLater] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(state.people > 1);
  const bodyRef = useRef(null);

  const { dayCounts, times, conflict } = state;
  // The chosen time went (taken while sending, or gone from the list): the time step asks again. Not while the times
  // are still to come: a request asked again elsewhere opens on the ticket before its hour is in (lesson 2026-11-04).
  const timesPending = times.status === "loading" || times.status === "idle";
  const current = conflict || (step === "confirm" && !state.time && !timesPending) ? "time" : step;
  const index = STEPS.indexOf(current);
  const day = days.find((item) => item.value === state.day);
  const totals = visitTotals(state.picked);
  const counted = days.slice(0, COUNTED_DAYS);
  const freeDays = counted.filter((item) => dayCounts.byDay[item.value] > 0);
  // Nothing free for these services in the next two weeks: said on the services step, before a calendar of «پر».
  const noRoom = state.picked.length > 0 && dayCounts.status === "ready" && !freeDays.length;
  const together = state.people > 1 && !state.chain;
  // Back to back, a group's visit is as long as everyone's services one after another.
  const visitMinutes = totals.minutes * (state.people > 1 && state.chain ? state.people : 1);
  const tooLong = noRoom && !together && longestDay > 0 && visitMinutes > longestDay;
  const soonest = dayCounts.first ? { day: days.find((item) => item.value === dayCounts.first.day), time: dayCounts.first.time } : null;

  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0 });
  }, [current]);

  // The ticket lost its time (taken while sending, or gone): the form stays on the time step until one is tapped, so a
  // time the client never picked can never show up on the ticket by itself.
  useEffect(() => {
    if (step === "confirm" && current === "time") setStep("time");
  }, [step, current]);

  function go(next) {
    if (conflict) controller.dismissConflict();
    setStep(next);
  }

  function next() {
    if (current !== "services" || !state.picked.length || tooLong) return;
    if (noRoom) setLater(true);
    go("day");
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (current === "confirm") onSave(event);
    else next();
  }

  function pickDay(item) {
    if (item.closed) return;
    controller.setDay(item.value);
    go("time");
  }

  // What was answered so far, in the order it was asked.
  const done = [];
  if (index > 0) done.push({ id: "services", caption: state.picked.length > 1 ? `${fa(state.picked.length)} کار` : "کار", value: state.picked.map((item) => item.name).join(" + ") });
  if (index > 0 && state.people > 1) done.push({ id: "services", key: "people", caption: "چند نفر", value: `${fa(state.people)} نفر` });
  if (index > 2 && day && state.time) done.push({ id: "time", caption: "کِی", value: `${dayName(day)}، ${clockText(state.time)}` });

  const servicesNeeded = current === "services" && !state.picked.length;
  const showButton = current === "services" || current === "confirm";
  let buttonLabel = "ادامه";
  if (current === "services" && !state.picked.length) buttonLabel = "یه کار انتخاب کن";
  else if (current === "services" && tooLong) buttonLabel = "این‌طوری جا نمی‌شه";
  else if (current === "services" && noRoom) buttonLabel = "روزهای بعد رو ببین";
  else if (current === "confirm") buttonLabel = label;
  const buttonOff = current === "services" ? servicesNeeded || tooLong : !state.readiness.ok;

  return (
    <form className="vb vbWizard is-client" onSubmit={handleSubmit} noValidate aria-label={title}>
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
        <ol className="vbSteps" aria-label={`مرحلهٔ ${fa(index + 1)} از ${fa(STEPS.length)}`}>
          {STEPS.map((id, position) => (
            <li key={id} className={position < index ? "is-done" : position === index ? "is-now" : ""} />
          ))}
        </ol>
      </header>

      <div className="vbBody is-wizard" ref={bodyRef}>
        {done.length ? (
          <div className="vbDoneRow" role="group" aria-label="پاسخ‌های قبلی؛ برای تغییر بزن">
            {done.map((item) => (
              <button type="button" key={item.key || item.id} className="vbDoneChip" onClick={() => go(item.id)} aria-label={`${item.caption}: ${item.value}. تغییر`}>
                <small>{item.caption}</small>
                <b>{item.value}</b>
              </button>
            ))}
          </div>
        ) : null}

        <section className="vbStage" key={current} aria-labelledby="vb-question">
          {current === "services" ? (
            <>
              <h3 id="vb-question" className="vbQuestion">چه کاری؟</h3>
              <p className="vbQuestionHint">یکی یا چندتا؛ به همین ترتیب انجام می‌شن.</p>
              <div className="vbCards" role="group" aria-label="خدمت‌ها؛ به همین ترتیب انجام می‌شن">
                {services.map((service) => {
                  const order = state.selected.indexOf(service.key);
                  const on = order >= 0;
                  const length = service.minutes > 0 ? minutesText(service.minutes) : service.duration;
                  return (
                    <button
                      type="button"
                      key={service.key}
                      className={`vbCard${on ? " is-on" : ""}`}
                      aria-pressed={on}
                      onClick={() => controller.toggleService(service.key)}
                    >
                      <span className="vbCardTop">
                        <ServiceIcon emoji={service.emoji} name={service.name} size="sm" />
                        <i className="vbCardBadge" aria-hidden="true">{on ? (state.selected.length > 1 ? fa(order + 1) : <Check size={14} />) : "+"}</i>
                      </span>
                      <b>{service.name}</b>
                      <small>{[length, service.priceText].filter(Boolean).join(" · ")}</small>
                    </button>
                  );
                })}
              </div>
              {!withName ? (
                peopleOpen ? (
                  <div className="vbPeopleRow" role="group" aria-label="برای چند نفر؟">
                    <span>برای چند نفر؟</span>
                    {Array.from({ length: MAX_VISIT_PEOPLE }, (_, position) => position + 1).map((count) => (
                      <button
                        type="button"
                        key={count}
                        className={`vbService vbCount${state.people === count ? " is-on" : ""}`}
                        aria-pressed={state.people === count}
                        onClick={() => controller.setPeople(count)}
                      >
                        {fa(count)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button type="button" className="vbLink vbFriend" onClick={() => setPeopleOpen(true)}>
                    <Users size={15} aria-hidden="true" /> با دوستت میای؟
                  </button>
                )
              ) : null}
              {noRoom ? (
                <NoRoom
                  count={state.picked.length}
                  people={together ? state.people : 1}
                  tooLong={tooLong ? minutesText(visitMinutes) : ""}
                  placeName={placeName}
                  onChain={() => controller.chainPeople()}
                />
              ) : null}
              <p className="vbSummary" aria-live="polite">
                {state.limitHit
                  ? `حداکثر ${fa(maxServicesFor(state.people))} کار توی یه نوبت${state.people > 1 ? ` برای ${fa(state.people)} نفر` : ""}.`
                  : visitSummaryText(state.picked, state.people) || "روی هر کاری که می‌خوای بزن."}
              </p>
            </>
          ) : null}

          {current === "day" ? (
            <>
              <h3 id="vb-question" className="vbQuestion">چه روزی؟</h3>
              {dayCounts.status === "ready" && freeDays.length > 0 && freeDays.length <= 3 ? (
                <p className="vbFewDays" role="status">
                  فقط {freeDays.length === 1 ? "یه روز" : `${fa(freeDays.length)} روز`} جا داره: {freeDays.map(dayName).join("، ")}
                </p>
              ) : null}
              {noRoom ? (
                <NoRoom
                  count={state.picked.length}
                  people={together ? state.people : 1}
                  phone={contactPhone}
                  onChain={() => controller.chainPeople()}
                />
              ) : null}
              {dayCounts.status === "error" ? (
                <p className="vbInfo is-error" role="alert">
                  شمار وقت‌های خالی نیومد؛ روزها رو می‌شه باز کرد.{" "}
                  <button type="button" className="vbLink" onClick={() => controller.retryDays()}>دوباره بزن</button>
                </p>
              ) : null}
              {soonest?.day ? (
                <button
                  type="button"
                  className="vbSoonest"
                  onClick={() => {
                    if (controller.pickSoonest()) go("confirm");
                  }}
                >
                  <span>
                    <small>زودترین وقت خالی</small>
                    <b>{dayName(soonest.day)}{soonest.time ? `، ساعت ${clockText(soonest.time)}` : ""}</b>
                  </span>
                  <Zap size={20} aria-hidden="true" />
                </button>
              ) : null}
              <div className="vbCalendar" role="group" aria-label="روز">
                {(later || noRoom ? days : counted).map((item, position) => {
                  const status = position < COUNTED_DAYS ? dayStatus(item, dayCounts) : { text: item.closed ? "تعطیل" : "", tone: item.closed ? "off" : "" };
                  return (
                    <button
                      type="button"
                      key={item.value}
                      aria-pressed={state.day === item.value}
                      aria-disabled={item.closed || undefined}
                      className={`vbDayCard${state.day === item.value ? " is-on" : ""}${status.tone ? ` is-${status.tone}` : ""}`}
                      onClick={() => pickDay(item)}
                    >
                      <small>{dayShort(item)}</small>
                      <b>{dayDate(item)}</b>
                      <em>{status.text}</em>
                    </button>
                  );
                })}
              </div>
              {!later && !noRoom && days.length > COUNTED_DAYS ? (
                <button type="button" className="vbLink" onClick={() => setLater(true)}>روزهای بعد</button>
              ) : null}
            </>
          ) : null}

          {current === "time" ? (
            <>
              <h3 id="vb-question" className="vbQuestion">ساعت چند؟</h3>
              <DayRail days={days} counts={dayCounts} value={state.day} onPick={(value) => controller.setDay(value)} />
              {conflict && times.status === "ready" ? (
                <TakenNotice
                  taken={conflict.taken}
                  day={day}
                  left={times.list}
                  onTake={(time) => {
                    controller.takeTime(time);
                    go("confirm");
                  }}
                  onOtherDay={() => {
                    controller.dismissConflict();
                    go("day");
                  }}
                />
              ) : null}
              <TimesList
                state={state}
                role="client"
                phone={contactPhone}
                withName={withName}
                waitlist={waitlist ? { ...waitlist, dayLabel: day?.label || "" } : null}
                onPick={(time) => {
                  if (conflict) controller.dismissConflict();
                  controller.setTime(time);
                  go("confirm");
                }}
                onRetry={() => controller.retryTimes()}
                onAhead={() => controller.goToAhead()}
                onChain={() => controller.chainPeople()}
              />
            </>
          ) : null}

          {current === "confirm" ? (
            <>
              <h3 id="vb-question" className="vbQuestion">همه‌چی درسته؟</h3>
              {!state.time ? (
                <p className="vbInfo" role="status">دارم چک می‌کنم…</p>
              ) : (
                <div className="vbTicket" aria-live="polite">
                  <div className="vbTicketHead">
                    <small>{placeName}</small>
                    <b>{dayName(day)}، ساعت {clockText(state.time)}</b>
                  </div>
                  <div className="vbTicketBody">
                    <PlanList role="client" state={state} onStaff={() => {}} onRetry={() => controller.retryPlan()} />
                    {state.plan.status === "ok" && state.plan.parts.length > 1 ? (
                      <p className="vbPlanNote">آرتیست‌ها رو سالن پیشنهاد داده و شاید عوضشون کنه. اگه ساعت رو عوض کنه، اول از خودت می‌پرسه.</p>
                    ) : null}
                    <p className="vbTicketTotal">{visitSummaryText(state.picked, state.people)}</p>
                  </div>
                </div>
              )}
              {!String(state.phone || "").trim() ? (
                <div className="vbWho is-readonly" aria-label="اطلاعات تماس">
                  <span><small>شماره موبایل</small><b dir="ltr">هنوز نذاشتی</b></span>
                  {typeof onEditProfile === "function" ? <button type="button" className="vbLink" onClick={onEditProfile}>شماره‌ت رو بذار</button> : null}
                </div>
              ) : null}
              {state.time ? (
                <WaitChoice
                  value={state.wait}
                  onChange={(wait) => controller.setWait(wait)}
                  backups={state.backups.list}
                  backup={state.backup}
                  onBackup={(id) => controller.setBackup(id)}
                  disabled={state.submitting}
                />
              ) : null}
            </>
          ) : null}
        </section>
      </div>

      <footer className="vbFoot">
        {hint && (current === "confirm" || current === "time") ? <p className="vbHint" role="alert">{hint}</p> : null}
        {current === "confirm" ? <p className="vbNotice">{ATTEND_NOTICE}</p> : null}
        {showButton ? (
          <button
            type="submit"
            className={`vbSubmit${buttonOff ? " is-incomplete" : ""}`}
            disabled={state.submitting}
            aria-disabled={buttonOff || undefined}
          >
            {current === "confirm" ? <CalendarCheck size={18} aria-hidden="true" /> : null}
            {buttonLabel}
            {current === "confirm" || buttonOff ? null : <ArrowLeft size={18} aria-hidden="true" />}
          </button>
        ) : null}
      </footer>
    </form>
  );
}
