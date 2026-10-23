"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, CalendarCheck, CalendarClock, Check, Clock3, ListChecks, Phone, Send, TimerOff, X, XCircle } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { bookingWaitMinutes, requestMinutesLeft, requestRemainingShare } from "../../shared/lib/bookingWindow";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import { pushNotificationsSupported, subscribeToPushNotifications } from "../shell/homeAppHelpers";
import { bookingEndLabel, clientBookingKey, movedToName } from "./bookingStatus";
import { bookingPeople } from "../../shared/lib/bookingParts";


function stageOf(status = "") {
  if (status === "تایید شده") return "ok";
  if (status === "لغو") return "bad";
  if (status === "منقضی شده") return "expired";
  if (status === AWAITING_CLIENT) return "offer";
  return "wait";
}

// A request with the hour waits that long at most, and never past its own start (bookingExpirySweep),
// same as the status strip. One that waits until its appointment has no countdown (null).
function minutesLeft(booking, now) {
  const windowMinutes = bookingWaitMinutes(booking);
  if (windowMinutes === null) return null;
  const left = requestMinutesLeft(booking?.created_at || booking?.createdAt, booking?.booking_date || booking?.date, booking?.time, { now: new Date(now), windowMinutes });
  return left === null ? null : Math.max(0, left);
}

function alertState() {
  if (typeof window === "undefined" || typeof Notification === "undefined" || !pushNotificationsSupported()) return "none";
  return Notification.permission; // default | granted | denied
}

/**
 * Right after «ثبت درخواست نوبت»: a full screen that answers "now what?" (tested: clients did not
 * know what happened after booking). It says the request reached the salon/artist, that the visit is
 * not final yet, how long the answer can take, asks for notifications at the one moment they make
 * sense, and shows where to follow it. It follows the live booking, so the answer
 * (confirmed / declined / expired / a new time offered) lands on this same screen with the next step.
 */
export function BookingReceipt({ receipt, bookings = [], onClose, onViewBookings, onOpenDetails, onRebook }) {
  const [now, setNow] = useState(() => Date.now());
  const [alerts, setAlerts] = useState(alertState);
  const titleRef = useRef(null);
  useBackHandler(Boolean(receipt), () => onClose?.());

  const live = useMemo(() => {
    if (!receipt) return null;
    const found = bookings.find((booking) => clientBookingKey(booking) === receipt.key);
    return found ? { ...receipt.booking, ...found } : receipt.booking;
  }, [receipt, bookings]);

  useEffect(() => {
    if (!receipt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    titleRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [receipt, onClose]);

  if (!receipt || !live || typeof document === "undefined") return null;

  const isArtist = live.bookingSource === "artist";
  const who = isArtist ? "آرتیست" : "سالن";
  const place = live.salonName || live.salon_name || who;
  const stage = stageOf(live.status);
  // Every service on its own line. The picked services come with the receipt; a booking opened
  // later only has the joined text (« + »), which is split back into names.
  const lines = (() => {
    const picked = (Array.isArray(receipt.items) ? receipt.items : []).filter((item) => item?.name);
    if (picked.length) {
      return picked.map((item) => ({
        name: item.name,
        emoji: item.emoji || "",
        duration: item.duration || "",
        price: parseTomanAmount(item.price)
      }));
    }
    const names = String(live.service || "").split(" + ").map((name) => name.trim()).filter(Boolean);
    if (!names.length) return [{ name: "نوبت", emoji: live.service_emoji, duration: "", price: 0 }];
    return names.map((name, index) => ({
      name,
      emoji: index === 0 ? live.service_emoji : "",
      duration: "",
      price: names.length === 1 ? parseTomanAmount(receipt.price) : 0
    }));
  })();
  const day = formatRelativeBookingDayLabel(live.booking_date || live.date || "امروز");
  const time = live.time ? toPersianDigits(live.time) : "";
  const end = bookingEndLabel(live);
  const price = parseTomanAmount(receipt.price);
  const left = stage === "wait" ? minutesLeft(live, now) : null;
  const phone = live.salonPhone || live.salon_phone || "";
  const waitsOpen = stage === "wait" && bookingWaitMinutes(live) === null;
  const backupName = stage === "wait" && !waitsOpen ? live.fallback_name || "" : "";
  const movedTo = stage === "expired" ? movedToName(live) : "";
  const people = bookingPeople(live);

  const hero = {
    wait: {
      icon: Send,
      title: `درخواستت به ${place} رسید`,
      // A group is one request, answered together (owner's decision 2026-10-22).
      text: people > 1 ? `درخواست ${toPersianDigits(people)} نفره ارسال شد. ${who} ${people === 2 ? "هر دو" : "هر سه"} را با هم جواب می‌دهد.` : `منتظر تأیید ${who} باش.`
    },
    ok: { icon: Check, title: "نوبتت قطعی شد", text: `${day} ساعت ${time}` },
    offer: { icon: CalendarClock, title: `${place} ساعت دیگری پیشنهاد داده`, text: "ساعت پیشنهادی را قبول یا رد کن." },
    bad: { icon: XCircle, title: "این ساعت قبول نشد", text: "یک ساعت دیگر انتخاب کن." },
    expired: movedTo
      ? { icon: Send, title: `درخواستت رفت برای ${movedTo}`, text: `${place} به‌موقع جواب نداد؛ حالا منتظر جواب ${movedTo} باش.` }
      : { icon: TimerOff, title: `${place} به‌موقع جواب نداد`, text: "می‌توانی دوباره بفرستی." }
  }[stage];
  const HeroIcon = hero.icon;

  const enableAlerts = async () => {
    await subscribeToPushNotifications();
    setAlerts(alertState());
  };

  return createPortal(
    <div className={`brScreen is-${stage}`} role="dialog" aria-modal="true" aria-labelledby="brTitle">
      <div className="brTop">
        <button type="button" className="brClose" onClick={onClose} aria-label="بستن">
          <X size={20} />
        </button>
        <span>{stage === "ok" ? "نوبت قطعی" : "درخواست نوبت"}</span>
        <span className="brTopSpacer" aria-hidden="true" />
      </div>

      <div className="brBody">
        <div className="brHero" aria-live="polite">
          <span className={`brRing is-${stage}`} aria-hidden="true"><HeroIcon size={34} /></span>
          <h2 id="brTitle" ref={titleRef} tabIndex={-1}>{hero.title}</h2>
          <p>{hero.text}</p>
        </div>

        {stage === "wait" && left !== null ? (
          <div className="brCount">
            <div>
              <strong>{toPersianDigits(left)}</strong>
              <span>دقیقه تا پاسخ {who}</span>
            </div>
            <span className="brBar" aria-hidden="true"><i style={{ transform: `scaleX(${requestRemainingShare(live?.created_at || live?.createdAt, live?.booking_date || live?.date, live?.time, { now: new Date(now), windowMinutes: bookingWaitMinutes(live) }) ?? 0})` }} /></span>
            <small className="brCountNote">{backupName ? `اگر جواب نداد، می‌رود برای ${backupName}.` : "اگر جواب نداد، لغو می‌شود."}</small>
          </div>
        ) : null}
        {waitsOpen ? (
          <p className="brWaitNote">
            <Clock3 size={15} aria-hidden="true" />
            {who} تا قبل از نوبت (حداکثر ۲۴ ساعت) وقت دارد جواب بدهد. اگر دیر شد، از «نوبت‌های من» لغوش کن.
          </p>
        ) : null}

        <div className="brCard brSummary">
          <p className="brPlace">{place}</p>
          <ul className="brLines" aria-label="خدمات این نوبت">
            {lines.map((line, index) => (
              <li key={`${line.name}-${index}`} className="brSvc">
                <ServiceIcon emoji={line.emoji} name={line.name} size="sm" />
                <span>
                  <b>{line.name}</b>
                  {line.duration ? <small>{toPersianDigits(line.duration)}</small> : null}
                </span>
                {line.price ? <em>{formatTomanNumber(line.price)} <small>تومان</small></em> : null}
              </li>
            ))}
          </ul>
          {lines.length > 1 && price ? (
            <div className="brTotal">
              <span>جمع</span>
              <em>{formatTomanNumber(price)} <small>تومان</small></em>
            </div>
          ) : null}
          <div className="brRow">
            <span><Clock3 size={15} aria-hidden="true" /> زمان</span>
            <b>{day}{time ? `، ساعت ${time}` : ""}{end ? ` تا ${toPersianDigits(end)}` : ""}</b>
          </div>
        </div>

        <div className="brActions">
          {stage === "wait" && alerts === "default" ? (
            <button type="button" className="brBtn is-accent" onClick={enableAlerts}>
              <BellRing size={18} aria-hidden="true" />
              اعلان را روشن کن
            </button>
          ) : null}
          {stage === "wait" && alerts === "granted" ? (
            <p className="brOk"><BellRing size={16} aria-hidden="true" /> اعلان روشن است.</p>
          ) : null}

          {stage === "offer" ? (
            <button type="button" className="brBtn" onClick={() => onOpenDetails?.(live)}>
              <CalendarClock size={18} aria-hidden="true" />
              دیدن ساعت پیشنهادی و جواب دادن
            </button>
          ) : null}
          {stage === "bad" || (stage === "expired" && !movedTo) ? (
            <button type="button" className="brBtn" onClick={() => onRebook?.(live)}>
              <CalendarCheck size={18} aria-hidden="true" />
              انتخاب ساعت دیگر
            </button>
          ) : null}

          <button type="button" className={`brBtn ${stage === "wait" || stage === "ok" ? "" : "is-soft"}`} onClick={() => onViewBookings?.(live)}>
            <ListChecks size={18} aria-hidden="true" />
            دیدن در «نوبت‌های من»
          </button>

          {stage === "ok" && phone ? (
            <a className="brBtn is-soft" href={`tel:${phone}`}>
              <Phone size={18} aria-hidden="true" />
              تماس با {place}
            </a>
          ) : null}
        </div>

      </div>
    </div>,
    document.body
  );
}
