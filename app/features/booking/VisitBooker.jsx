"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CalendarCheck, Check, ChevronRight, Plus, Scissors } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toPersianDigits } from "../../shared/lib/digits";
import { createVisitBookerController } from "./visitBookerController";
import { VisitWizard } from "./VisitWizard";
import { WaitChoice } from "./WaitChoice";
import { PlanList, TimesList } from "./visitBookerParts";
import { notify } from "../../shared/notice/noticeStore";
import { MAX_VISIT_PEOPLE, clockText, maxServicesFor, missingText, visitSummaryText } from "./visitBookerModel";

const ROLE_COPY = {
  client: { submit: "بفرست", busy: "دارم می‌فرستم…" },
  salon: { submit: "ثبت کن", busy: "دارم ثبت می‌کنم…" },
  artist: { submit: "ثبت کن", busy: "دارم ثبت می‌کنم…" }
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
  onEditProfile,
  contactPhone = "",
  withName = ""
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
        contactPhone={contactPhone}
        withName={withName}
        onClose={onClose}
      />
    </ProfileSheet>
  );
}

/** `withName`: the client asked for one team member («رزرو با …»): one person only, and empty days say it is them who is full. */
function VisitBookerForm({ role, title, subtitle, services, days, initial, customers, source, onSubmit, onDone, onAddService, onEditProfile, contactPhone, withName, onClose }) {
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
      ...(source.loadPlan ? { loadPlan: (query) => latest.current.source.loadPlan(query) } : {}),
      ...(source.loadBackups ? { loadBackups: (query) => latest.current.source.loadBackups(query) } : {})
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
  const summary = visitSummaryText(state.picked, state.people);
  const { readiness } = state;
  const checking = readiness.reason === "checking";
  const phoneMissing = role === "client" && !String(state.phone || "").trim();
  // What to say above the button, most important first.
  let hint = "";
  if (state.error) hint = state.error;
  // A problem with one service is written on its row; the rest are said here.
  else if (readiness.reason === "problem" && !(state.plan.partIndex >= 0)) hint = readiness.message || "این ساعت برای این نوبت جا نداره؛ یه ساعت دیگه انتخاب کن.";
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
  else if (checking) label = "دارم چک می‌کنم…";
  else if (readiness.ok && day) label = `${copy.submit} برای ${day.label}، ${clockText(state.time)}`;

  // A salon or artist with no services cannot book anything yet: say so, and take them to add one.
  if (role !== "client" && !frozenServices.length) {
    return (
      <div className="vb vbNoService" role="group" aria-label={title}>
        <span className="vbNoServiceIcon"><Scissors size={30} aria-hidden="true" /></span>
        <h2>اول خدمت‌هات رو اضافه کن</h2>
        <p>برای ثبت نوبت دست‌کم یه خدمت لازمه تا مدت نوبت و ساعت‌های خالی حساب بشه. فقط یه بار.</p>
        <button type="button" className="vbSubmit" onClick={onAddService}>
          <Plus size={18} aria-hidden="true" />
          افزودن خدمت
        </button>
        <button type="button" className="vbLink" onClick={onClose}>بعداً</button>
      </div>
    );
  }

  // Salon and artist: one question at a time. The client keeps the single page below.
  if (role !== "client") {
    return (
      <VisitWizard
        role={role}
        title={title}
        state={state}
        controller={controller}
        services={frozenServices}
        days={frozenDays}
        customers={customers}
        copy={copy}
        hint={hint}
        label={label}
        onClose={onClose}
        onSave={handleSubmit}
      />
    );
  }

  return (
    <form className={`vb is-${role}`} onSubmit={handleSubmit} noValidate aria-label={title}>
      <header className="vbHead">
        <button type="button" className="vbBack" onClick={onClose} aria-label="برگشت">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <h2>{title}</h2>
        {subtitle ? <small>{subtitle}</small> : null}
      </header>

      <div className="vbBody">
        {/* The client's own name and number are already known; the card shows only to ask for a missing number. */}
        {phoneMissing ? (
          <section className="vbWho is-readonly" aria-label="اطلاعات تماس">
            <span><small>شماره موبایل</small><b dir="ltr">نداری هنوز</b></span>
            {typeof onEditProfile === "function" ? (
              <button type="button" className="vbLink" onClick={onEditProfile}>شماره‌ت رو بذار</button>
            ) : null}
          </section>
        ) : null}

        <section className="vbSection" aria-label="خدمت‌ها">
          {frozenServices.length ? (
            <>
              <div className="vbChips" role="group" aria-label="خدمت‌ها؛ به همین ترتیب انجام می‌شن">
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
                  ? `حداکثر ${toPersianDigits(maxServicesFor(state.people))} کار توی یه نوبت${state.people > 1 ? ` برای ${toPersianDigits(state.people)} نفر` : ""}.`
                  : summary || "یکی یا چندتا کار انتخاب کن."}
              </p>
            </>
          ) : (
            <button type="button" className="vbEmpty" onClick={onAddService}>
              <Plus size={16} aria-hidden="true" />
              هنوز خدمتی نداری؛ اولیش رو اضافه کن
            </button>
          )}
        </section>

        {frozenServices.length && !withName ? (
          <section className="vbSection vbPeople" aria-label="برای چند نفر؟">
            <p className="vbPeopleTitle" id="vb-people-label">برای چند نفر؟</p>
            <div className="vbChips" role="group" aria-labelledby="vb-people-label">
              {Array.from({ length: MAX_VISIT_PEOPLE }, (_, index) => index + 1).map((count) => (
                <button
                  type="button"
                  key={count}
                  className={`vbService vbCount${state.people === count ? " is-on" : ""}`}
                  aria-pressed={state.people === count}
                  onClick={() => controller.setPeople(count)}
                >
                  {toPersianDigits(count)}
                </button>
              ))}
            </div>
            {state.people > 1 && state.chain ? (
              <p className="vbSummary">{toPersianDigits(state.people)} نوبت پشت‌سرهم. <button type="button" className="vbLink" onClick={() => controller.setPeople(state.people)}>با هم، هم‌زمان</button></p>
            ) : null}
          </section>
        ) : null}

        <section className="vbSection" aria-label="روز">
          <div className="vbChips" role="group" aria-label="روز">
            {frozenDays.map((item) => (
              <button
                type="button"
                key={item.value}
                aria-pressed={state.day === item.value}
                className={`vbDay${state.day === item.value ? " is-on" : ""}${item.closed ? " is-closed" : ""}`}
                onClick={() => controller.setDay(item.value)}
              >
                {item.label}
                {item.closed ? <small>تعطیل</small> : null}
              </button>
            ))}
            {role === "client" ? (
              <button type="button" className="vbDay is-closed is-horizon" onClick={() => notify({ id: "booking-horizon", title: "فعلاً تا ۶۰ روز جلوتر", text: "برای بعدش به سالن زنگ بزن.", tone: "info" })}>
                بعدش؟
              </button>
            ) : null}
          </div>
        </section>

        <section className="vbSection vbTimesSection" aria-label="ساعت">
          <TimesList
            state={state}
            role={role}
            phone={contactPhone}
            withName={withName}
            onPick={(time) => controller.setTime(time)}
            onRetry={() => controller.retryTimes()}
            onAhead={() => controller.goToAhead()}
            onChain={() => controller.chainPeople()}
          />
        </section>

        {state.time ? (
          <section className="vbSection vbPlanSection" aria-label="برنامهٔ نوبت" aria-live="polite">
            <PlanList role={role} state={state} onStaff={(index, name) => controller.setStaff(index, name)} onRetry={() => controller.retryPlan()} />
            {role === "client" && state.plan.status === "ok" && state.plan.parts.length > 1 ? (
              <p className="vbPlanNote">آرتیست‌ها رو سالن پیشنهاد داده و شاید عوضشون کنه. اگه ساعت رو عوض کنه، اول از خودت می‌پرسه.</p>
            ) : null}
          </section>
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
      </div>

      <footer className="vbFoot">
        {state.conflict ? (
          <div className="vbConflict" role="alert">
            {state.conflict.next ? (
              <>
                <p>این ساعت همین الان پر شد. ساعت خالی بعدی: {clockText(state.conflict.next)}. همین رو بفرستم؟</p>
                <div className="vbConflictActions">
                  <button type="button" className="vbAction is-primary" disabled={state.submitting} onClick={() => void controller.acceptConflict()}>آره، بفرست</button>
                  <button type="button" className="vbAction" onClick={() => controller.dismissConflict()}>یه ساعت دیگه</button>
                </div>
              </>
            ) : (
              <>
                <p>این ساعت همین الان پر شد و این روز دیگه ساعت خالی نداره. یه روز دیگه انتخاب کن.</p>
                <div className="vbConflictActions">
                  <button type="button" className="vbAction" onClick={() => controller.dismissConflict()}>باشه</button>
                </div>
              </>
            )}
          </div>
        ) : null}
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
