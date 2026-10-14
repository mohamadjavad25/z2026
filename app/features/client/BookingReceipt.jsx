"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, CalendarCheck, CalendarClock, Check, Clock3, ListChecks, Phone, Send, TimerOff, X, XCircle } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { formatRequestExpiryDeadline, toIsoLikeTimestamp } from "../../shared/lib/time";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";
import { pushNotificationsSupported, subscribeToPushNotifications } from "../shell/homeAppHelpers";
import { bookingEndLabel, clientBookingKey } from "./bookingStatus";

const WINDOW_MIN = 60; // a request is auto-cancelled after an hour (bookingExpirySweep), same as the status strip

function stageOf(status = "") {
  if (status === "تایید شده") return "ok";
  if (status === "لغو") return "bad";
  if (status === "منقضی شده") return "expired";
  if (status === AWAITING_CLIENT) return "offer";
  return "wait";
}

function minutesLeft(booking, now) {
  const created = new Date(toIsoLikeTimestamp(booking?.created_at || booking?.createdAt) || "").getTime();
  if (!Number.isFinite(created)) return null;
  return Math.min(WINDOW_MIN, Math.max(0, Math.ceil((created + WINDOW_MIN * 60000 - now) / 60000)));
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
  const service = shortServiceLabel(live.service) || "نوبت";
  const day = formatRelativeBookingDayLabel(live.booking_date || live.date || "امروز");
  const time = live.time ? toPersianDigits(live.time) : "";
  const end = bookingEndLabel(live);
  const price = parseTomanAmount(receipt.price);
  const deadline = formatRequestExpiryDeadline(live.created_at || live.createdAt);
  const left = stage === "wait" ? minutesLeft(live, now) : null;
  const phone = live.salonPhone || live.salon_phone || "";

  const hero = {
    wait: { icon: Send, title: `درخواستت به ${place} رسید`, text: `نوبت هنوز قطعی نیست. وقتی ${who} تأیید کند، همین‌جا و با اعلان خبرت می‌کنیم.` },
    ok: { icon: Check, title: "نوبتت قطعی شد", text: `${place} درخواستت را تأیید کرد. ${day} ساعت ${time} منتظرت هستند.` },
    offer: { icon: CalendarClock, title: `${place} ساعت دیگری پیشنهاد داده`, text: "ساعتی که خواستی آزاد نبود. ساعت پیشنهادی را ببین و قبول یا رد کن." },
    bad: { icon: XCircle, title: "این ساعت قبول نشد", text: `${place} این ساعت را نتوانست قبول کند. یک ساعت دیگر انتخاب کن.` },
    expired: { icon: TimerOff, title: `${place} به‌موقع جواب نداد`, text: "درخواست خودش لغو شد. می‌توانی همین حالا دوباره بفرستی." }
  }[stage];
  const HeroIcon = hero.icon;

  const steps = [
    { state: "done", title: "درخواست فرستاده شد", text: `به ${place}` },
    stage === "wait"
      ? { state: "now", title: `${who} درخواستت را بررسی می‌کند`, text: deadline ? `معمولاً زودتر؛ حداکثر تا ساعت ${deadline}` : "معمولاً در کمتر از یک ساعت" }
      : stage === "expired"
        ? { state: "late", title: "جوابی نیامد", text: "مهلت یک‌ساعته تمام شد" }
        : { state: "done", title: `${who} جواب داد`, text: "" },
    stage === "ok"
      ? { state: "done", title: "نوبت قطعی شد", text: `${day} ساعت ${time}` }
      : stage === "offer"
        ? { state: "now", title: "منتظر جواب توست", text: "ساعت پیشنهادی را قبول یا رد کن" }
        : stage === "bad"
          ? { state: "fail", title: "این ساعت قبول نشد", text: "ساعت دیگری انتخاب کن" }
          : stage === "expired"
            ? { state: "late", title: "درخواست لغو شد", text: "می‌توانی دوباره بفرستی" }
            : { state: "next", title: "نوبت قطعی می‌شود", text: "با تأیید، خبرت می‌کنیم" }
  ];

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
              <span>دقیقه تا مهلت جواب {who}{deadline ? ` (تا ساعت ${deadline})` : ""}. اگر جواب ندهد، درخواست خودش لغو می‌شود.</span>
            </div>
            <span className="brBar" aria-hidden="true"><i style={{ transform: `scaleX(${left / WINDOW_MIN})` }} /></span>
          </div>
        ) : null}

        <div className="brCard brSummary">
          <div className="brSvc">
            <ServiceIcon emoji={live.service_emoji} name={live.service} size="sm" />
            <span>
              <b>{service}</b>
              <small>{place}</small>
            </span>
            {price ? <em>{formatTomanNumber(price)} <small>تومان</small></em> : null}
          </div>
          <div className="brRow">
            <span><Clock3 size={15} aria-hidden="true" /> زمان</span>
            <b>{day}{time ? ` · ${time}` : ""}{end ? ` تا ${toPersianDigits(end)}` : ""}</b>
          </div>
        </div>

        <ol className="brCard brSteps" aria-label="مراحل نوبت">
          {steps.map((step, index) => (
            <li key={step.title} className={`is-${step.state}`}>
              <span className="brDot" aria-hidden="true">
                {step.state === "done" ? <Check size={13} strokeWidth={3} /> : step.state === "fail" ? <X size={13} strokeWidth={3} /> : step.state === "late" ? "!" : toPersianDigits(index + 1)}
              </span>
              <span>
                <b>{step.title}</b>
                {step.text ? <small>{step.text}</small> : null}
              </span>
            </li>
          ))}
        </ol>

        <div className="brActions">
          {stage === "wait" && alerts === "default" ? (
            <button type="button" className="brBtn is-accent" onClick={enableAlerts}>
              <BellRing size={18} aria-hidden="true" />
              اعلان را روشن کن تا جواب را از دست ندهی
            </button>
          ) : null}
          {stage === "wait" && alerts === "granted" ? (
            <p className="brOk"><BellRing size={16} aria-hidden="true" /> اعلان روشن است؛ جواب را خبرت می‌کنیم.</p>
          ) : null}

          {stage === "offer" ? (
            <button type="button" className="brBtn" onClick={() => onOpenDetails?.(live)}>
              <CalendarClock size={18} aria-hidden="true" />
              دیدن ساعت پیشنهادی و جواب دادن
            </button>
          ) : null}
          {stage === "bad" || stage === "expired" ? (
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
          {stage === "wait" ? (
            <button type="button" className="brBtn is-soft" onClick={onClose}>
              برگشت به صفحهٔ {place}
            </button>
          ) : null}
        </div>

        {stage === "wait" ? (
          <p className="brTip">
            لازم نیست این صفحه باز بماند. جواب {who} روی نوار پایین صفحه و در «نوبت‌های من» (دکمهٔ عکس خودت، وسط پایین) دیده می‌شود.
          </p>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
