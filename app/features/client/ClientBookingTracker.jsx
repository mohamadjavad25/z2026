"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarClock, Check, ChevronLeft, Hourglass, TimerOff, XCircle } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { bookingWaitMinutes, requestDeadlineLabel, requestRemainingShare } from "../../shared/lib/bookingWindow";
import { isBookingInPast, movedToSalonName } from "./bookingStatus";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

const PENDING = new Set(["درخواست", "تازه"]);
const FLASH_MS = 7000;

// The strip docks into the bottom bar (see .cbt in polish.css). A div, not a button: the bar's own
// button styles must not reach it.
function Strip({ className, onClick, children, ...rest }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`cbt ${className}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

const keyOf = (booking) => `${booking.bookingSource === "artist" ? "a" : "s"}${booking.id}`;
const placeOf = (booking) => booking.salonName || booking.salon_name || "سالن";

// A request that waits until its appointment has no clock to run down: its bar just moves.
function remainingShare(booking, now) {
  const windowMinutes = bookingWaitMinutes(booking);
  if (windowMinutes === null) return null;
  return requestRemainingShare(booking.created_at || booking.createdAt, booking.booking_date || booking.date, booking.time, { now: new Date(now), windowMinutes });
}

/**
 * A status strip docked into the top of the bottom bar, for the client's own booking requests.
 * - While a request waits for the salon / artist: a live "processing" look (spinning ring,
 *   moving progress bar showing how much of the answer window is left, or just moving when the
 *   client chose to wait until the appointment).
 * - The moment it is answered (seen through the 10 s refresh): the chip flips to
 *   "confirmed" / "cancelled" / "expired" for a few seconds, then goes away.
 * - A salon offered a new time and waits for the client's answer: that comes first, until answered.
 * Tapping opens the booking details.
 */
export function ClientBookingTracker({ bookings = [], onOpen }) {
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(null);
  const seen = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Detect requests that were pending and have just been answered.
  useEffect(() => {
    const next = new Map(bookings.map((booking) => [keyOf(booking), booking.status || ""]));
    const before = seen.current;
    seen.current = next;
    if (!before) return;
    for (const booking of bookings) {
      const was = before.get(keyOf(booking));
      const status = booking.status || "";
      if (was && PENDING.has(was) && ["تایید شده", "لغو", "منقضی شده"].includes(status)) {
        setFlash({ booking, status });
        return;
      }
    }
  }, [bookings]);

  // The answer stays on screen for a few seconds, then the chip goes away.
  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const pending = useMemo(() => (
    bookings
      .filter((booking) => PENDING.has(booking.status || "تازه") && !isBookingInPast(booking))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
  ), [bookings]);

  const offers = useMemo(() => (
    bookings.filter((booking) => booking.status === AWAITING_CLIENT && booking.bookingSource !== "artist" && !isBookingInPast(booking))
  ), [bookings]);

  // Tell the page the bar has grown a strip so it can reserve room for it
  // (otherwise the bar covers the last card of whatever list is underneath).
  const chipVisible = Boolean(flash) || pending.length > 0 || offers.length > 0;
  useEffect(() => {
    if (!chipVisible) return undefined;
    document.documentElement.dataset.cbt = "1";
    return () => { delete document.documentElement.dataset.cbt; };
  }, [chipVisible]);

  if (flash) {
    const { booking, status } = flash;
    const confirmed = status === "تایید شده";
    const Icon = confirmed ? Check : status === "لغو" ? XCircle : TimerOff;
    const movedTo = movedToSalonName(booking);
    const title = confirmed ? "رزرو تأیید شد" : status === "لغو" ? "رزرو لغو شد" : movedTo ? `درخواستت رفت برای ${movedTo}` : "مهلت پاسخ تمام شد";
    return (
      <Strip
        className={`is-${confirmed ? "ok" : "bad"}`}
        onClick={() => { setFlash(null); onOpen?.(booking); }}
        aria-live="polite"
      >
        <span className="cbtIcon"><Icon size={20} /></span>
        <span className="cbtText">
          <b>{title}</b>
          <small>
            {shortServiceLabel(booking.service) || "نوبت"} • {placeOf(booking)}
            {confirmed ? ` • ${formatRelativeBookingDayLabel(booking.booking_date || booking.date || "امروز")} ${booking.time ? toPersianDigits(booking.time) : ""}` : ""}
          </small>
        </span>
        <ChevronLeft size={18} />
      </Strip>
    );
  }

  if (offers.length) {
    const offer = offers[0];
    return (
      <Strip className="is-offer" onClick={() => onOpen?.(offer)} aria-live="polite">
        <span className="cbtIcon" aria-hidden="true"><CalendarClock size={19} /></span>
        <span className="cbtText">
          <b>سالن ساعت تازه پیشنهاد داده</b>
          <small>
            {shortServiceLabel(offer.service) || "نوبت"} — {placeOf(offer)} — {formatRelativeBookingDayLabel(offer.booking_date || "امروز")} {offer.time ? toPersianDigits(offer.time) : ""}
          </small>
        </span>
        {offers.length > 1 ? <em className="cbtCount">{toPersianDigits(offers.length)}</em> : <ChevronLeft size={18} aria-hidden="true" />}
      </Strip>
    );
  }

  if (!pending.length) return null;
  const current = pending[0];
  const share = remainingShare(current, now);
  const deadline = requestDeadlineLabel(current.created_at || current.createdAt, current.booking_date || current.date, current.time, { windowMinutes: bookingWaitMinutes(current) });
  const label = current.bookingSource === "artist" ? "آرتیست" : "سالن";

  return (
    <Strip className="is-wait" onClick={() => onOpen?.(current)} aria-live="polite">
      <span className="cbtIcon is-spin" aria-hidden="true">
        <i />
        <Hourglass size={18} />
      </span>
      <span className="cbtText">
        <b>منتظر تأیید {label}</b>
        <small>
          {shortServiceLabel(current.service) || "نوبت"} — {placeOf(current)}
          {deadline ? ` — حداکثر تا ${deadline}` : ""}
        </small>
      </span>
      {pending.length > 1 ? <em className="cbtCount">{toPersianDigits(pending.length)}</em> : <CalendarCheck size={18} aria-hidden="true" />}
      {share !== null ? <span className="cbtBar" aria-hidden="true"><i style={{ transform: `scaleX(${share})` }} /></span> : <span className="cbtBar is-indeterminate" aria-hidden="true"><i /></span>}
    </Strip>
  );
}
