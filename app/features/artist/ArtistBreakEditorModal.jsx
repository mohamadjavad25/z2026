"use client";

import { useMemo } from "react";
import { toPersianDigits } from "../../shared/lib/digits";
import { minutesToPersianTime, timeLabelToMinutes, rangesOverlap } from "../../shared/lib/time";
import { PERSIAN_WEEKDAYS, formatPersianDateKey } from "../../shared/lib/persianCalendar";
import { ALL_BREAK_DAYS, BREAK_NOW_MINUTES, activeNowBreak, weekdayOfDateKey } from "../../shared/lib/artistBreak";
import { bookingHoldsSlot } from "../../shared/lib/salonAvailability";
import { SheetClose } from "../../components/SheetClose";

const DAY_LETTERS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const STEP = 30;

/** Half-hour buttons from the earliest opening to the latest closing of the artist's open days (8 to 23 without hours). */
export function breakHourButtons(hoursList = []) {
  const open = (hoursList || []).filter((item) => item?.active && item.open_time && item.close_time);
  const from = open.length ? Math.min(...open.map((item) => timeLabelToMinutes(item.open_time))) : 8 * 60;
  const to = open.length ? Math.max(...open.map((item) => timeLabelToMinutes(item.close_time))) : 23 * 60;
  const list = [];
  for (let value = Math.floor(from / STEP) * STEP; value <= to; value += STEP) list.push(minutesToPersianTime(value));
  return list;
}

/** Upcoming bookings that fall inside the window on its days: they stay, but the artist is told before saving. */
export function bookingsInBreak(bookings, draft, today = formatPersianDateKey(new Date())) {
  const start = timeLabelToMinutes(draft.start);
  const end = timeLabelToMinutes(draft.end);
  if (!(end > start)) return [];
  return (bookings || []).filter((booking) => {
    if (!bookingHoldsSlot(booking) || !booking.dateKey || booking.dateKey < today) return false;
    if (!draft.days.includes(weekdayOfDateKey(booking.dateKey))) return false;
    const from = timeLabelToMinutes(booking.time);
    return rangesOverlap(from, from + Math.max(15, Number(booking.durationMinutes) || 60), start, end);
  });
}

/**
 * «تایم استراحت» (owner's decision 2026-11-02): «الان استراحت می‌کنم» for 15/30/60 minutes today, the weekdays the
 * daily window holds on, and the window itself picked with two taps on half-hour buttons (start, then end) inside the
 * artist's working hours. Bookings already inside the window are named before saving and stay.
 * Presentational: draft + callbacks; the state stays in useArtistWorkspace.
 */
export function ArtistBreakEditorModal({
  open = false,
  draft = { start: "", end: "", days: ALL_BREAK_DAYS },
  breakTime = null,
  hoursList = [],
  bookings = [],
  hasBreak = false,
  saving = false,
  onDraftChange,
  onSave,
  onClear,
  onBreakNow,
  onClose
}) {
  const hours = useMemo(() => breakHourButtons(hoursList), [hoursList]);
  const today = formatPersianDateKey(new Date());
  const inside = useMemo(() => (open ? bookingsInBreak(bookings, draft, today) : []), [open, bookings, draft, today]);
  if (!open) return null;

  const startMin = draft.start ? timeLabelToMinutes(draft.start) : null;
  const endMin = draft.end ? timeLabelToMinutes(draft.end) : null;
  const ready = startMin != null && endMin != null && endMin > startMin && draft.days.length > 0;
  const nowBreak = activeNowBreak(breakTime, today);

  // First tap: the start. Second tap after it: the end. A tap before the start (or on a full window) starts again.
  const tapHour = (slot) => {
    const value = timeLabelToMinutes(slot);
    onDraftChange?.((prev) => {
      const from = prev.start ? timeLabelToMinutes(prev.start) : null;
      if (from == null || prev.end || value <= from) return { ...prev, start: slot, end: "" };
      return { ...prev, end: slot };
    });
  };
  const toggleDay = (day) => onDraftChange?.((prev) => ({
    ...prev,
    days: prev.days.includes(day) ? prev.days.filter((item) => item !== day) : [...prev.days, day].sort((a, b) => a - b)
  }));

  let summary = "ساعت شروع رو بزن.";
  if (startMin != null && endMin == null) summary = `از ${draft.start}؛ حالا ساعت آخرش رو بزن.`;
  if (ready) summary = `از ${draft.start} تا ${draft.end}، ${toPersianDigits(endMin - startMin)} دقیقه`;

  return (
    <div className="artistServiceModal" role="dialog" aria-modal="true" aria-label="تایم استراحت" onClick={onClose}>
      <article className="artistServiceSheet artistBreakSheet" onClick={(event) => event.stopPropagation()}>
        <header className="artistBreakHead">
          <h3>تایم استراحت</h3>
          <p>توی این ساعت‌ها کسی ازت نوبت نمی‌گیره. نوبت‌هایی که از قبل داری سر جاشون می‌مونن.</p>
        </header>
        <div className="artistBreakModalBody">
          <section className="abNow" aria-label="الان استراحت می‌کنم">
            <span className="abLabel">الان استراحت می‌کنم</span>
            {nowBreak ? (
              <div className="abNowOn">
                <span>تا {toPersianDigits(nowBreak.end)} استراحتی.</span>
                <button type="button" onClick={() => onBreakNow?.(0)} disabled={saving}>تمومش کن</button>
              </div>
            ) : (
              <div className="abChips">
                {BREAK_NOW_MINUTES.map((minutes) => (
                  <button type="button" key={minutes} className="abChip" onClick={() => onBreakNow?.(minutes)} disabled={saving}>
                    {minutes === 60 ? "۱ ساعت" : `${toPersianDigits(minutes)} دقیقه`}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="abDaily" aria-label="استراحت هر روز">
            <span className="abLabel">روزهایی که استراحت داری</span>
            <div className="abDays" role="group" aria-label="روزها">
              {DAY_LETTERS.map((letter, day) => (
                <button
                  type="button"
                  key={letter}
                  className={`abDay${draft.days.includes(day) ? " is-on" : ""}`}
                  aria-pressed={draft.days.includes(day)}
                  aria-label={PERSIAN_WEEKDAYS[day]}
                  onClick={() => toggleDay(day)}
                >
                  {letter}
                </button>
              ))}
            </div>
            <span className="abLabel">ساعتش</span>
            <div className="abHours" role="group" aria-label="ساعت استراحت">
              {hours.map((slot) => {
                const value = timeLabelToMinutes(slot);
                const edge = slot === draft.start || slot === draft.end;
                const between = ready && value > startMin && value < endMin;
                return (
                  <button
                    type="button"
                    key={slot}
                    className={`abHour${edge ? " is-on" : between ? " is-mid" : ""}`}
                    aria-pressed={edge}
                    onClick={() => tapHour(slot)}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
            <p className={`abSum${ready ? " is-ready" : ""}`} aria-live="polite">{draft.days.length ? summary : "دست‌کم یه روز رو روشن کن."}</p>
            {ready && inside.length ? (
              <p className="abWarn">
                {inside.length === 1 ? "یه نوبت" : `${toPersianDigits(inside.length)} نوبت`} توی این ساعته:{" "}
                {inside.slice(0, 3).map((booking) => `${booking.date} ${booking.time}، ${booking.client}`).join("؛ ")}
                {inside.length > 3 ? "؛ …" : ""}. سر جاشون می‌مونن.
              </p>
            ) : null}
          </section>

          <div className="artistBreakEditorActions">
            <button type="button" onClick={onSave} disabled={!ready || saving}>
              {saving ? "دارم ذخیره می‌کنم…" : "ذخیره کن"}
            </button>
            {hasBreak ? (
              <button type="button" className="danger" onClick={onClear} disabled={saving}>پاکش کن</button>
            ) : null}
          </div>
        </div>
        <SheetClose onClick={onClose} />
      </article>
    </div>
  );
}
