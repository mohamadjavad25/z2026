"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Check, ChevronLeft, Hourglass, TimerOff, XCircle } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { formatRequestExpiryDeadline, toIsoLikeTimestamp } from "../../shared/lib/time";
import { isBookingInPast } from "./bookingStatus";

const PENDING = new Set(["درخواست", "تازه"]);
const WINDOW_MS = 60 * 60 * 1000; // a request is auto-cancelled after an hour (bookingExpirySweep)
const FLASH_MS = 7000;

const keyOf = (booking) => `${booking.bookingSource === "artist" ? "a" : "s"}${booking.id}`;
const placeOf = (booking) => booking.salonName || booking.salon_name || "سالن";

function remainingShare(booking, now) {
  const created = new Date(toIsoLikeTimestamp(booking.created_at || booking.createdAt) || "").getTime();
  if (!Number.isFinite(created)) return null;
  return Math.max(0, Math.min(1, (created + WINDOW_MS - now) / WINDOW_MS));
}

/**
 * A floating status chip above the bottom bar for the client's own booking requests.
 * - While a request waits for the salon / artist: a live "processing" look (spinning ring,
 *   moving progress bar showing how much of the one-hour answer window is left).
 * - The moment it is answered (seen through the 10 s refresh): the chip flips to
 *   "confirmed" / "cancelled" / "expired" for a few seconds, then goes away.
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

  // Tell the page a chip is floating above the bottom bar so it can reserve room for it
  // (otherwise it covers the last card of whatever list is underneath).
  const chipVisible = Boolean(flash) || pending.length > 0;
  useEffect(() => {
    if (!chipVisible) return undefined;
    document.documentElement.dataset.cbt = "1";
    return () => { delete document.documentElement.dataset.cbt; };
  }, [chipVisible]);

  if (flash) {
    const { booking, status } = flash;
    const confirmed = status === "تایید شده";
    const Icon = confirmed ? Check : status === "لغو" ? XCircle : TimerOff;
    const title = confirmed ? "رزرو تأیید شد" : status === "لغو" ? "رزرو لغو شد" : "مهلت پاسخ تمام شد";
    return (
      <button
        type="button"
        className={`cbt is-${confirmed ? "ok" : "bad"}`}
        onClick={() => { setFlash(null); onOpen?.(booking); }}
        aria-live="polite"
      >
        <span className="cbtIcon"><Icon size={20} /></span>
        <span className="cbtText">
          <b>{title}</b>
          <small>
            {booking.service || "نوبت"} • {placeOf(booking)}
            {confirmed ? ` • ${formatRelativeBookingDayLabel(booking.booking_date || booking.date || "امروز")} ${booking.time ? toPersianDigits(booking.time) : ""}` : ""}
          </small>
        </span>
        <ChevronLeft size={18} />
      </button>
    );
  }

  if (!pending.length) return null;
  const current = pending[0];
  const share = remainingShare(current, now);
  const deadline = formatRequestExpiryDeadline(current.created_at || current.createdAt);
  const label = current.bookingSource === "artist" ? "آرتیست" : "سالن";

  return (
    <button type="button" className="cbt is-wait" onClick={() => onOpen?.(current)} aria-live="polite">
      <span className="cbtIcon is-spin" aria-hidden="true">
        <i />
        <Hourglass size={18} />
      </span>
      <span className="cbtText">
        <b>منتظر تأیید {label}</b>
        <small>
          {current.service || "نوبت"} — {placeOf(current)}
          {deadline ? ` — حداکثر تا ${deadline}` : ""}
        </small>
      </span>
      {pending.length > 1 ? <em className="cbtCount">{toPersianDigits(pending.length)}</em> : <CalendarCheck size={18} aria-hidden="true" />}
      {share !== null ? <span className="cbtBar" aria-hidden="true"><i style={{ transform: `scaleX(${share})` }} /></span> : <span className="cbtBar is-indeterminate" aria-hidden="true"><i /></span>}
    </button>
  );
}
