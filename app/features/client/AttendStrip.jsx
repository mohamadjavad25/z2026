"use client";

import { useState } from "react";
import { CalendarHeart, CheckCircle2 } from "lucide-react";
import { ATTEND_NO_LABEL, ATTEND_YES_LABEL, attendanceQuestion, attendanceState } from "../../shared/lib/attendance";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";

/**
 * «میای؟» (owner's decision of 2026-10-27): the day before a confirmed visit the client answers right on the card.
 * «آره، میام» tells the salon or artist; «نمی‌تونم» asks once more, then cancels so the time can go to someone waiting.
 * After a yes the strip says so. Nothing shows outside the last day before the visit.
 */
export function AttendStrip({ booking, onAttend, onCancel, compact = false }) {
  const [step, setStep] = useState("ask");
  const [busy, setBusy] = useState("");
  const state = attendanceState(booking);
  if (!state || (!onAttend && state === "ask")) return null;
  const stop = (event) => event.stopPropagation();
  const place = booking.bookingSource === "artist" ? "آرتیست" : "سالن";

  if (state === "yes") {
    return (
      <div className={`cvAttend is-yes${compact ? " is-compact" : ""}`} role="status" onClick={stop}>
        <CheckCircle2 size={16} aria-hidden="true" />
        <span>گفتی میای؛ {place} منتظرته.</span>
      </div>
    );
  }

  const day = formatRelativeBookingDayLabel(booking.booking_date || booking.date || "");
  const yes = async () => {
    setBusy("yes");
    await onAttend(booking);
    setBusy("");
  };
  const cancel = async () => {
    setBusy("no");
    const ok = await onCancel?.(booking);
    setBusy("");
    if (!ok) setStep("ask");
  };

  if (step === "sure") {
    return (
      <div className={`cvAttend is-sure${compact ? " is-compact" : ""}`} role="group" aria-label="لغو نوبت" onClick={stop}>
        <p>لغوش کنیم که جات به یکی دیگه برسه؟ {place} همون لحظه خبردار می‌شه.</p>
        <div className="cvAttendActions">
          <button type="button" className="is-no" disabled={Boolean(busy)} onClick={cancel}>
            {busy === "no" ? "دارم لغو می‌کنم…" : "آره، لغو کن"}
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => setStep("ask")}>نه، میام</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`cvAttend${compact ? " is-compact" : ""}`} role="group" aria-label="میای؟" onClick={stop}>
      <p><CalendarHeart size={16} aria-hidden="true" /><b>{attendanceQuestion(day, booking.time)}</b></p>
      <div className="cvAttendActions">
        <button type="button" className="is-yes" disabled={Boolean(busy)} onClick={yes}>
          {busy === "yes" ? "یه لحظه…" : ATTEND_YES_LABEL}
        </button>
        {onCancel ? (
          <button type="button" disabled={Boolean(busy)} onClick={() => setStep("sure")}>{ATTEND_NO_LABEL}</button>
        ) : null}
      </div>
    </div>
  );
}
