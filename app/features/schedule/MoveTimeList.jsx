"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Sparkles
} from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { minutesToPersianTime, normalizeBookingTimeLabel, timeLabelToMinutes } from "../../shared/lib/time";
import { getArtistProposalTimes } from "../../shared/api/providerExit";
import { getSalonBookingMoveTimes } from "../../shared/api/salons";

/**
 * «تغییر ساعت»: only the times this booking really fits at, asked from the server with the same
 * rules the move itself is checked by -- its services with their artists, nothing else in the
 * way, ending by closing time. Times that run past closing come last, marked with how much
 * longer the salon would stay, and are sent only as a deliberate choice. On top, «پیشنهادی»: the
 * free times closest to the current one, the likeliest move. Each time is a chip at the start
 * of its row, and the row's empty side fades out.
 */
export function MoveTimeList({ booking, disabled, onPick }) {
  const [state, setState] = useState({ id: null, loading: true, times: [], close: "", closed: false, failed: false });
  useEffect(() => {
    let alive = true;
    setState({ id: booking.id, loading: true, times: [], close: "", closed: false, failed: false });
    // An independent artist's own booking: the free times of its day from GET /api/booking-proposals (no overtime).
    const load = booking.ownerType === "salon"
      ? getSalonBookingMoveTimes(booking.id)
      : getArtistProposalTimes(booking.id).then(({ ok, payload }) => ({
        ok,
        data: {
          times: (payload?.data?.times || []).map((time) => ({
            time,
            end: minutesToPersianTime(timeLabelToMinutes(time) + (Number(booking.durationMinutes) || 60)),
            overtimeMinutes: 0
          }))
        }
      }));
    load.then(({ ok, data }) => {
      if (!alive) return;
      setState({ id: booking.id, loading: false, times: ok ? data.times || [] : [], close: data?.close || "", closed: Boolean(data?.closed), failed: !ok });
    }).catch(() => {
      if (alive) setState({ id: booking.id, loading: false, times: [], close: "", closed: false, failed: true });
    });
    return () => { alive = false; };
  }, [booking.id, booking.time, booking.parts]);

  const current = normalizeBookingTimeLabel(booking.time || "");
  const inHours = state.times.filter((option) => !option.overtimeMinutes);
  const late = state.times.filter((option) => option.overtimeMinutes > 0);
  const others = inHours.filter((option) => option.time !== current);
  const currentMinutes = timeLabelToMinutes(current);
  const suggested = Number.isFinite(currentMinutes)
    ? [...others].sort((a, b) => Math.abs(timeLabelToMinutes(a.time) - currentMinutes) - Math.abs(timeLabelToMinutes(b.time) - currentMinutes)).slice(0, 3)
      .sort((a, b) => timeLabelToMinutes(a.time) - timeLabelToMinutes(b.time))
    : others.slice(0, 3);

  if (state.loading) return <p className="sbmMoveNote">دارم ساعت‌های خالی رو پیدا می‌کنم…</p>;
  if (state.failed) return <p className="sbmMoveNote is-warn">ساعت‌های خالی نیومد؛ دوباره بزن.</p>;
  if (state.closed) return <p className="sbmMoveNote is-warn">سالن این روز تعطیله.</p>;

  const row = (option, overtime) => {
    const active = option.time === current;
    return (
      <button
        type="button"
        key={option.time}
        className={`${active ? "is-selected" : ""}${overtime ? " is-overtime" : ""}`}
        disabled={disabled || active}
        onClick={() => {
          if (overtime && typeof window !== "undefined" && !window.confirm(
            `این نوبت تا ${toPersianDigits(option.end)} طول می‌کشه؛ یعنی ${toPersianDigits(option.overtimeMinutes)} دقیقه بیشتر از ساعت کاری می‌مونی. بفرستم؟`
          )) return;
          onPick(option.time, overtime);
        }}
      >
        <span className="sbmMoveChip"><SegmentClock value={option.time} size="xs" as="span" backgroundColor="transparent" /></span>
        <span className="sbmMoveCopy">
          <b>تا {toPersianDigits(option.end)}</b>
          {active ? <small>ساعت فعلی</small> : overtime ? <small>{toPersianDigits(option.overtimeMinutes)} دقیقه بیشتر می‌مونی</small> : null}
        </span>
        {active ? <Check size={16} /> : null}
      </button>
    );
  };

  return (
    <div className="scheduleBookingPickList is-move">
      {suggested.length ? (
        <div className="sbmSuggest">
          <p className="sbmSuggestHead"><Sparkles size={14} aria-hidden="true" /> پیشنهادی</p>
          <div className="sbmSuggestRow">
            {suggested.map((option) => (
              <button type="button" key={option.time} disabled={disabled} onClick={() => onPick(option.time, false)} aria-label={`جابه‌جایی به ${toPersianDigits(option.time)} تا ${toPersianDigits(option.end)}`}>
                <b>{toPersianDigits(option.time)}</b>
                <small>تا {toPersianDigits(option.end)}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {others.length === 0 ? (
        <p className="sbmMoveNote is-warn">
          {late.length
            ? `تا آخر ساعت کاری (${toPersianDigits(state.close)}) ساعت خالی دیگه‌ای برای این نوبت نیست.`
            : "این روز ساعت خالی دیگه‌ای برای این نوبت نیست."}
        </p>
      ) : null}
      {inHours.map((option) => row(option, false))}
      {late.length ? (
        <>
          <p className="sbmMoveHead">اگه بعد از ساعت کاری بمونی (سالن تا {toPersianDigits(state.close)} بازه)</p>
          {late.map((option) => row(option, true))}
        </>
      ) : null}
    </div>
  );
}
