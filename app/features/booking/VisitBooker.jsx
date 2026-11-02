"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Plus, Scissors } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { createVisitBookerController } from "./visitBookerController";
import { VisitWizard } from "./VisitWizard";
import { ClientVisitWizard } from "./ClientVisitWizard";
import { NameConflictSheet } from "./NameConflictSheet";
import { findNameConflict } from "../salons/customers";
import { renameCustomer } from "../../shared/api/customers";
import { clockText, missingText } from "./visitBookerModel";

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
  withName = "",
  waitlist = null,
  placeName = "",
  longestDay = 0
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
        waitlist={waitlist}
        placeName={placeName}
        longestDay={longestDay}
        onClose={onClose}
      />
    </ProfileSheet>
  );
}

/** `withName`: the client asked for one team member («رزرو با …»): one person only, and empty days say it is them who is full. */
function VisitBookerForm({ role, title, subtitle, services, days, initial, customers, source, onSubmit, onDone, onAddService, onEditProfile, contactPhone, withName, waitlist, placeName, longestDay, onClose }) {
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
      ...(source.loadBackups ? { loadBackups: (query) => latest.current.source.loadBackups(query) } : {}),
      ...(source.loadDays ? { loadDays: (query) => latest.current.source.loadDays(query) } : {})
    },
    submit: (body) => latest.current.onSubmit(body),
    // A client chooses the day: an empty one is said so (with the first free hour ahead), never skipped silently.
    autoAdvance: role !== "client",
    daysDelay: role === "client" ? 350 : 0
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
  const { readiness } = state;
  const checking = readiness.reason === "checking";
  // What to say above the button, most important first.
  let hint = "";
  if (state.error) hint = state.error;
  // A problem with one service is written on its row; the rest are said here.
  else if (readiness.reason === "problem" && !(state.plan.partIndex >= 0)) hint = readiness.message || "این ساعت برای این نوبت جا نداره؛ یه ساعت دیگه انتخاب کن.";
  else if (state.tried && readiness.reason === "missing") hint = missingText(readiness.missing);

  // A salon or artist typing a new name for a number they already have under another one is asked what to do first
  // (owner's decision 2026-10-31); `nameAsk` holds the question until it is answered.
  const [nameAsk, setNameAsk] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");

  function send() {
    void controller.submit().then((result) => {
      if (result?.ok || result?.reason !== "missing") return;
      // Take the person to the first thing that is missing.
      const target = result.missing?.[0] === "نام مشتری" ? "#vb-name" : result.missing?.[0] === "شماره تماس" ? "#vb-phone" : result.missing?.[0] === "خدمت" ? ".vbService" : ".vbTime";
      document.querySelector(`.visitBookerSheet ${target}`)?.focus?.();
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    // Only once everything else is filled in, so the «what is missing» hint keeps coming first.
    const conflict = role !== "client" && !state.submitting && !state.done && readiness.ok ? findNameConflict(customers, state.phone, state.name) : null;
    if (conflict) {
      setRenameError("");
      setNameAsk(conflict);
      return;
    }
    send();
  }

  function answerName(choice) {
    const ask = nameAsk;
    setNameAsk(null);
    if (choice === "keep") controller.setName(ask.mainName);
    else if (choice === "account") controller.setName(ask.accountName);
    send();
  }

  async function renameThenSend() {
    setRenaming(true);
    setRenameError("");
    let result;
    try {
      result = await renameCustomer(state.phone, state.name);
    } catch {
      result = { ok: false };
    }
    setRenaming(false);
    if (!result?.ok) {
      setRenameError("اسم عوض نشد؛ اینترنتت رو چک کن و دوباره بزن.");
      return;
    }
    setNameAsk(null);
    send();
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
        <p>برای ثبت نوبت دست‌کم یه خدمت لازمه؛ فقط یه بار.</p>
        <button type="button" className="vbSubmit" onClick={onAddService}>
          <Plus size={18} aria-hidden="true" />
          خدمت تازه
        </button>
        <button type="button" className="vbLink" onClick={onClose}>بعداً</button>
      </div>
    );
  }

  // Salon and artist: one question at a time, asking who the customer is.
  if (role !== "client") {
    return (
      <>
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
        <NameConflictSheet
          ask={nameAsk}
          busy={renaming}
          error={renameError}
          onBoth={() => answerName("both")}
          onKeepOld={() => answerName("keep")}
          onRename={renameThenSend}
          onUseAccount={() => answerName("account")}
          onClose={() => { if (!renaming) setNameAsk(null); }}
        />
      </>
    );
  }

  // The client: the same one question at a time, with the client's own steps (owner's decision of 2026-11-02).
  return (
    <ClientVisitWizard
      title={title}
      placeName={placeName}
      state={state}
      controller={controller}
      services={frozenServices}
      days={frozenDays}
      contactPhone={contactPhone}
      withName={withName}
      waitlist={waitlist}
      hint={hint}
      label={label}
      longestDay={longestDay}
      startStep={frozen.initial?.time && frozen.initial?.day && !(frozen.initial?.people > 1) ? "confirm" : ""}
      onClose={onClose}
      onSave={handleSubmit}
      onEditProfile={onEditProfile}
    />
  );
}
