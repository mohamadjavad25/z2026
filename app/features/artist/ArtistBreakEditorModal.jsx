"use client";

import { X } from "lucide-react";
import { BreakTimeWheel } from "../../components/BreakTimeWheel";
import { toPersianDigits } from "../../shared/lib/digits";
import { buildClockOptions, timeLabelToMinutes } from "../../shared/lib/time";

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
        <button type="button" className="artistServiceClose artistBreakClose" onClick={onClose} aria-label="بستن">
          <X size={17} />
        </button>

        <div className="artistBreakModalBody">
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
              <em>{isInvalid ? "نامعتبر" : `${toPersianDigits(durationMinutes)} دقیقه`}</em>
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
              {saving ? "در حال ذخیره..." : "ذخیره بازه"}
            </button>
            {hasBreak ? (
              <button type="button" className="danger" onClick={onClear} disabled={saving}>حذف</button>
            ) : null}
            <button type="button" className="ghost" onClick={onClose}>بستن</button>
          </div>
        </div>
      </article>
    </div>
  );
}
