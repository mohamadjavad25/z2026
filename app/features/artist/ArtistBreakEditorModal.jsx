"use client";

import { BreakTimeWheel } from "../../components/BreakTimeWheel";
import { toPersianDigits } from "../../shared/lib/digits";
import { buildClockOptions, timeLabelToMinutes } from "../../shared/lib/time";
import { SheetClose } from "../../components/SheetClose";

// Typical lunch/rest windows: one tap, then save.
const QUICK_BREAKS = [
  ["۱۲:۰۰", "۱۳:۰۰"],
  ["۱۳:۰۰", "۱۴:۰۰"],
  ["۱۴:۰۰", "۱۵:۰۰"],
  ["۱۵:۰۰", "۱۶:۰۰"]
];

/**
 * Artist owner — break time range editor modal.
 * Presentational: draft + save/clear/close callbacks (state stays in HomeApp / hook).
 */
export function ArtistBreakEditorModal({
  open = false,
  draft = { start: "۱۳:۰۰", end: "۱۴:۰۰" },
  hasBreak = false,
  saving = false,
  onDraftChange,
  onSave,
  onClear,
  onClose
}) {
  if (!open) return null;

  const clockOptions = buildClockOptions();
  const startOptions = clockOptions.slice(0, -1);
  const startMinutes = timeLabelToMinutes(draft.start);
  const endMinutes = timeLabelToMinutes(draft.end);
  const durationMinutes = Math.max(0, endMinutes - startMinutes);
  const isInvalid = endMinutes <= startMinutes;
  const disabledEnds = clockOptions.filter(
    (slot) => timeLabelToMinutes(slot) <= startMinutes
  );

  const pickStart = (slot) => {
    onDraftChange?.((prev) => {
      const nextStartMin = timeLabelToMinutes(slot);
      const currentEndMin = timeLabelToMinutes(prev.end);
      if (currentEndMin > nextStartMin) {
        return { ...prev, start: slot };
      }
      const nextEnd = clockOptions.find((item) => timeLabelToMinutes(item) > nextStartMin)
        || clockOptions[clockOptions.length - 1];
      return { start: slot, end: nextEnd };
    });
  };

  return (
    <div
      className="artistServiceModal"
      role="dialog"
      aria-modal="true"
      aria-label="تایم استراحت"
      onClick={onClose}
    >
      <article className="artistServiceSheet artistBreakSheet" onClick={(event) => event.stopPropagation()}>
        {/* A title and what it does: the window opened with only clocks and «ذخیره بازه» (owner's choice 2026-10-23). */}
        <header className="artistBreakHead">
          <h3>تایم استراحت</h3>
          <p>یه بازه برای همهٔ روزها؛ توی برنامه‌ت استراحت نشون داده می‌شه.</p>
        </header>
        <div className="artistBreakModalBody">
          <div className="qrChips" role="group" aria-label="بازه‌های رایج">
            {QUICK_BREAKS.filter(([from, to]) => clockOptions.includes(from) && clockOptions.includes(to)).map(([from, to]) => (
              <button
                type="button"
                key={`${from}-${to}`}
                className={`qrChip${draft.start === from && draft.end === to ? " is-on" : ""}`}
                onClick={() => onDraftChange?.({ start: from, end: to })}
              >
                {toPersianDigits(from)} تا {toPersianDigits(to)}
              </button>
            ))}
          </div>
          <div className={`artistBreakRange is-side ${isInvalid ? "is-invalid" : ""}`}>
            <div className="artistBreakRangeCol">
              <span className="artistBreakRangeLabel">از</span>
              <BreakTimeWheel
                options={startOptions}
                value={draft.start}
                onChange={pickStart}
                ariaLabel="ساعت شروع استراحت"
              />
            </div>

            <div className="artistBreakRangeMid" aria-hidden="true">
              <span className="artistBreakRangeArrow">←</span>
              <em>{isInvalid ? "درست نیست" : `${toPersianDigits(durationMinutes)} دقیقه`}</em>
            </div>

            <div className="artistBreakRangeCol">
              <span className="artistBreakRangeLabel">تا</span>
              <BreakTimeWheel
                options={clockOptions}
                value={draft.end}
                disabledValues={disabledEnds}
                onChange={(slot) => onDraftChange?.((prev) => ({ ...prev, end: slot }))}
                ariaLabel="ساعت پایان استراحت"
              />
            </div>
          </div>

          <div className="artistBreakEditorActions">
            <button type="button" onClick={onSave} disabled={isInvalid || saving}>
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
