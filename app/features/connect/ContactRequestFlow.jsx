"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ContactRound, MessageSquareText, ScanLine } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { sendContactRequest } from "../../shared/api/contactRequests";
import { contactPickerSupported, invitePhoneOf, isMobilePhone, localPhoneOf, pickContact } from "../../shared/lib/contactPicker";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { buildInviteSmsHref } from "../../shared/lib/inviteSms";
import { toPersianDigits } from "../../shared/lib/digits";
import { ConnectSheet } from "./ConnectSheet";
import { firstOpenDay, requestDays, requestHours, saveRequestDraft } from "./requestDraft";
import { ServiceRow } from "./ServiceListSheet";
import { searchClientServices } from "../../shared/constants/clientServices";

export const CONTACT_REQUESTS_CHANGED = "frfro:contact-requests-changed";

const whenLabel = (date, time) => `${formatRelativeBookingDayLabel(date)}، ساعت ${toPersianDigits(time)}`;
const maskedPhone = (phone) => (phone.length >= 11 ? `${phone.slice(0, 4)} ••• ${phone.slice(-4)}` : phone);

/**
 * A client's request to a salon or artist that is not on frfro yet (owner, 2026-11-12): the day and hour, the
 * salon from the contacts (or its number, or its QR), one look, «بفرست». frfro texts that number a link; the
 * request then waits on the client's home (ContactRequestsCard).
 *
 * Props:
 *  - service: { id?, name, icon } the client picked
 *  - start: { contact, date, time } to open on the last step (a pick that came back after Android restarted the app)
 *  - mine: the client has salons, just none doing this (says so on the «where» step)
 *  - onFound(profile, { services, date, time }): that number is a salon or artist on frfro that does the service; the
 *    caller connects and opens its booking form on that day and hour. One that does not do it gets the request
 *    straight away (the done step), and an account closed for bookings is said on the confirm step.
 *  - onScan(): open the QR scanner instead
 */
export function ContactRequestFlow({ service: givenService = null, place = null, start = null, mine = false, clientName = "", onFound, onScan, onClose }) {
  // From a place's own page («کاری که می‌خوای اینجا نیست؟»): the place is set and the service is picked here first.
  const [service, setService] = useState(givenService);
  const days = useMemo(() => requestDays(), []);
  const [date, setDate] = useState(start?.date || firstOpenDay(days));
  const [time, setTime] = useState(start?.time || "");
  // A pick that came back after a restart opens on the last step; «برای یکی دیگه بفرست» (a no from a place) on «کجا بری؟».
  const [step, setStep] = useState(!givenService ? "service" : start?.contact ? "confirm" : start?.date && start?.time ? "where" : "when"); // service | when | where | confirm | done
  const [contact, setContact] = useState(place ? { name: place.name || "", phone: "", place: true } : start?.contact ? toTarget(start.contact) : null);
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const [canPick, setCanPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState(null); // { sms, request }
  const hours = useMemo(() => requestHours(date), [date]);

  useEffect(() => { setCanPick(contactPickerSupported()); }, []);

  function toTarget(picked) {
    return { name: picked.name || "", phone: localPhoneOf(picked.phones || []), mobile: (picked.phones || []).some(isMobilePhone) };
  }

  async function chooseContact() {
    setProblem("");
    saveRequestDraft({ service, date, time });
    try {
      const picked = await pickContact("request");
      if (!picked) return;
      if (!picked.phones?.length || !isMobilePhone(invitePhoneOf(picked.phones))) {
        setProblem(`${picked.name || "این مخاطب"} موبایل نداره؛ یکی دیگه رو انتخاب کن.`);
        return;
      }
      setContact(toTarget(picked));
      setStep("confirm");
    } catch {
      setProblem("به مخاطب‌هات دسترسی نداریم؛ شماره‌ش رو بزن.");
    }
  }

  function submitTyped(event) {
    event.preventDefault();
    if (!isMobilePhone(typed)) {
      setProblem("شمارهٔ موبایل رو این‌جوری بزن: ۰۹۱۲۳۴۵۶۷۸۹");
      return;
    }
    setProblem("");
    setContact({ name: "", phone: localPhoneOf([typed]), mobile: true });
    setStep("confirm");
  }

  async function send() {
    setBusy(true);
    setProblem("");
    try {
      const { ok, status, payload } = await sendContactRequest({
        ...(place ? { placeId: place.id } : { phone: contact.phone, contactName: contact.name }),
        service: service.name,
        serviceEmoji: service.icon || "",
        bookingDate: date,
        time
      });
      // On frfro and does the service: its booking form, on the same day and hour.
      if (ok && payload?.data?.found) {
        onFound?.(payload.data.found, { services: payload.data.services || [], date, time });
        return;
      }
      if (!ok) {
        setProblem(payload?.error || (status === 429 ? "زیاد امتحان کردی؛ یه کم دیگه دوباره بزن." : "نرفت؛ دوباره بزن."));
        return;
      }
      setResult(payload.data);
      if (payload.data?.direct && payload.data.place?.name) setContact((current) => ({ ...current, name: payload.data.place.name }));
      setStep("done");
      window.dispatchEvent(new Event(CONTACT_REQUESTS_CHANGED));
    } catch {
      setProblem("نرفت؛ دوباره بزن.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "service" || !service) {
    const hits = searchClientServices(query, { limit: 6 });
    const typedName = query.trim().slice(0, 60);
    return (
      <ConnectSheet label="چه کاری می‌خوای؟" title="چه کاری می‌خوای؟" subtitle={place?.name ? `از ${place.name}` : ""} onClose={onClose}>
        <label className="cnSearch">
          <span className="srOnly">اسم کار</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اسم کار" autoComplete="off" />
        </label>
        <div className="crServices">
          {hits.map((hit) => (
            <ServiceRow key={hit.id} service={hit} onPick={(picked) => { setService(picked); setStep("when"); }} />
          ))}
          {!hits.length && typedName.length > 1 ? (
            <ServiceRow service={{ name: typedName, icon: "" }} onPick={(picked) => { setService(picked); setStep("when"); }} />
          ) : null}
        </div>
      </ConnectSheet>
    );
  }

  const icon = <ServiceIcon emoji={service.icon} name={service.name} size="sm" />;
  const who = contact?.name || "این شماره";

  if (step === "done") {
    const link = result?.request?.link;
    const text = link ? `سلام${clientName ? `، ${clientName} هستم` : ""}. برای ${service.name}، ${whenLabel(date, time)} ازت نوبت خواستم: ${link}` : "";
    const smsHref = link ? buildInviteSmsHref(contact.phone, text) : "";
    return (
      <ConnectSheet label="درخواست رفت" title={service.name} icon={icon} onClose={onClose}>
        <div className="crDone">
          <CheckCircle2 size={34} aria-hidden="true" />
          <b>{smsHref ? "درخواستت ثبت شد" : `برای ${who} فرستادیم`}</b>
          <small>{smsHref ? "پیامکش رو خودت بفرست." : "جواب که داد، خبرت می‌کنیم."}</small>
        </div>
        {smsHref ? (
          <a className="crMainBtn" href={smsHref}>
            <MessageSquareText size={18} aria-hidden="true" />
            پیامک رو بفرست
          </a>
        ) : null}
        <button type="button" className={smsHref ? "crGhostBtn" : "crMainBtn"} onClick={onClose}>باشه</button>
      </ConnectSheet>
    );
  }

  if (step === "confirm" && contact) {
    return (
      <ConnectSheet label="فرستادن درخواست" title={contact.name ? `برای ${contact.name} بفرستیم؟` : "بفرستیم؟"} onClose={onClose}>
        <div className="crCard">
          <div className="crWho">
            <span className="crAvatar" aria-hidden="true">{(contact.name || "؟").trim().charAt(0)}</span>
            <span>
              <b>{contact.name || "سالن یا آرتیستت"}</b>
              {contact.place ? null : <small dir="ltr">{maskedPhone(contact.phone)}</small>}
            </span>
          </div>
          <div className="crService">{icon}<b>{service.name}</b></div>
          <b className="crWhen">{whenLabel(date, time)}</b>
        </div>
        {problem ? <p className="cnNote" role="alert">{problem}</p> : null}
        <button type="button" className="crMainBtn" disabled={busy} onClick={send}>{busy ? "…" : "بفرست"}</button>
        {place ? null : <button type="button" className="crGhostBtn" disabled={busy} onClick={() => { setContact(null); setProblem(""); setStep("where"); }}>یکی دیگه</button>}
      </ConnectSheet>
    );
  }

  if (step === "where") {
    return (
      <ConnectSheet label="کجا بری؟" title="کجا بری؟" subtitle={mine ? "سالن و آرتیست‌هات این کار رو ندارن." : ""} onClose={onClose}>
        <div className="cnScanRow">
          {canPick ? (
            <button type="button" className="cnScanBtn crPickBtn" onClick={chooseContact}>
              <span aria-hidden="true"><ContactRound size={20} /></span>
              <span><b>از مخاطب‌هام</b></span>
            </button>
          ) : null}
          <button type="button" className="cnScanBtn" onClick={onScan}>
            <span aria-hidden="true"><ScanLine size={20} /></span>
            <span><b>اسکن QR</b></span>
          </button>
        </div>
        <form className="crTyped" onSubmit={submitTyped}>
          <label className="cnSearch">
            <span className="srOnly">شمارهٔ سالن یا آرتیستت</span>
            <input
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="crGhostBtn" disabled={!typed.trim()}>بعدی</button>
        </form>
        {problem ? <p className="cnNote" role="alert">{problem}</p> : null}
      </ConnectSheet>
    );
  }

  return (
    <ConnectSheet label="کی؟" title={service.name} subtitle="کی؟" icon={icon} onClose={onClose}>
      <div className="crDays" role="group" aria-label="روز">
        {days.map((day) => (
          <button
            type="button"
            key={day.key}
            className={`crDay${day.key === date ? " is-on" : ""}`}
            aria-pressed={day.key === date}
            onClick={() => { setDate(day.key); setTime(""); }}
          >
            <small>{day.top}</small>
            <b>{day.day}</b>
          </button>
        ))}
      </div>
      <div className="crHours" role="group" aria-label="ساعت">
        {hours.map((hour) => (
          <button
            type="button"
            key={hour.time}
            className={`crHour${hour.time === time ? " is-on" : ""}`}
            disabled={!hour.open}
            aria-pressed={hour.time === time}
            onClick={() => setTime(hour.time)}
          >
            {hour.label}
          </button>
        ))}
      </div>
      <button type="button" className="crMainBtn" disabled={!time} onClick={() => setStep(place ? "confirm" : "where")}>بعدی</button>
    </ConnectSheet>
  );
}
