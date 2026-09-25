"use client";

import { createPortal } from "react-dom";
import { ChevronDown, Minus, Plus, Timer, X } from "lucide-react";
import { BreakTimeWheel } from "../../components/BreakTimeWheel";
import { toPersianDigits } from "../../shared/lib/digits";
import { shortPersianWeekday, timeLabelToMinutes } from "../../shared/lib/time";

/**
 * Salon hours editor nested inside the "تنظیمات" tab (SettingsPage).
 * Presentational: hours list/presets/selection owned by HomeApp / useSalonWorkspace.
 */
export function SalonHoursEditor({
  kicker = "تنظیمات سالن",
  open,
  onToggleOpen,
  presets = [],
  activePresetId,
  activePresetMeta,
  hoursList = [],
  selectedHour,
  timeOptions = [],
  openDaysCount = 0,
  weeklyCapacityTotal = 0,
  onSelectPreset,
  onSelectDay,
  onUpdateHour
}) {
  const clockOptions = timeOptions.length ? timeOptions : [];
  const startOptions = clockOptions.slice(0, -1);
  const startValue = selectedHour?.open_time || startOptions[0] || "۱۰:۰۰";
  const endValue = selectedHour?.close_time || clockOptions[clockOptions.length - 1] || "۲۰:۰۰";
  const startMinutes = timeLabelToMinutes(startValue);
  const endMinutes = timeLabelToMinutes(endValue);
  const disabledEnds = clockOptions.filter((slot) => timeLabelToMinutes(slot) <= startMinutes);
  const durationMinutes = Math.max(0, endMinutes - startMinutes);
  const isInvalidRange = selectedHour?.active && endMinutes <= startMinutes;

  const pickStart = (slot) => {
    if (!selectedHour) return;
    const nextStartMinutes = timeLabelToMinutes(slot);
    const currentEndMinutes = timeLabelToMinutes(endValue);
    const nextEnd = currentEndMinutes > nextStartMinutes
      ? endValue
      : (clockOptions.find((item) => timeLabelToMinutes(item) > nextStartMinutes) || endValue);
    onUpdateHour?.(selectedHour, { open_time: slot, close_time: nextEnd });
  };

  return (
    <div className="settingsSalonHours">
      <button
        type="button"
        className="settingsSalonHoursHead settingsSalonHoursToggle"
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        <Timer size={16} aria-hidden="true" />
        <div>
          <strong>ساعت کاری</strong>
          <span>قالب بزن، بعد هر روز را با یک لمس تنظیم کن</span>
        </div>
        <em className="settingsSalonHoursSummary">
          {toPersianDigits(openDaysCount)} روز باز
        </em>
        <ChevronDown size={15} className={`settingsSalonHoursChev ${open ? "is-open" : ""}`} aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div
          className="settingsHoursModal"
          role="dialog"
          aria-modal="true"
          aria-label="تنظیم ساعت کاری"
          onClick={onToggleOpen}
        >
          <article className="settingsHoursSheet" onClick={(event) => event.stopPropagation()}>
            <header className="settingsHoursHero">
              <Timer size={28} aria-hidden="true" />
              <div>
                <span>{kicker}</span>
                <strong>ساعت کاری</strong>
              </div>
              <em>{toPersianDigits(openDaysCount)} روز باز</em>
            </header>

            <div className="hoursPresetGrid settingsHoursPresetGrid" role="radiogroup" aria-label="قالب ساعت کاری">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={activePresetId === preset.id}
                  className={activePresetId === preset.id ? "is-active" : undefined}
                  onClick={() => onSelectPreset?.(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {activePresetMeta ? (
              <p className="hoursPresetHint settingsHoursPresetHint">{activePresetMeta.detail}</p>
            ) : null}

            <div className="hoursWeekStrip settingsHoursWeekStrip" role="tablist" aria-label="روزهای هفته">
              {hoursList.map((item) => {
                const isSelected = selectedHour?.day === item.day;
                return (
                  <button
                    key={item.day}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`${item.day}، ${item.active ? "باز" : "تعطیل"}`}
                    className={[
                      "hoursDayChip",
                      item.active ? "is-open" : "is-closed",
                      isSelected ? "is-selected" : ""
                    ].filter(Boolean).join(" ")}
                    onClick={() => onSelectDay?.(item.day)}
                  >
                    <b>{shortPersianWeekday(item.day)}</b>
                    <small>{item.active ? "باز" : "بسته"}</small>
                  </button>
                );
              })}
            </div>

            {selectedHour ? (
              <div className="hoursDayEditor settingsHoursDayEditor">
                <div className="hoursDayEditorTop">
                  <div>
                    <strong>{selectedHour.day}</strong>
                    <span>{selectedHour.active ? "برای این روز وقت می‌گیری" : "این روز تعطیل است"}</span>
                  </div>
                  <button
                    type="button"
                    className={`hoursOpenToggle ${selectedHour.active ? "is-on" : "is-off"}`}
                    aria-pressed={Boolean(selectedHour.active)}
                    onClick={() => onUpdateHour?.(selectedHour, { active: !selectedHour.active })}
                  >
                    {selectedHour.active ? "باز" : "تعطیل"}
                  </button>
                </div>

                {selectedHour.active ? (
                  <>
                    <div className={`settingsHoursWheelRange ${isInvalidRange ? "is-invalid" : ""}`}>
                      <div>
                        <span>از ساعت</span>
                        <BreakTimeWheel
                          options={startOptions}
                          value={startValue}
                          onChange={pickStart}
                          ariaLabel={`ساعت شروع ${selectedHour.day}`}
                          idPrefix={`salon-hour-open-${selectedHour.day}`}
                          activeColor="#24143f"
                          inactiveColor="rgba(36, 20, 63, 0.26)"
                          disabledColor="rgba(36, 20, 63, 0.12)"
                        />
                      </div>
                      <em>{isInvalidRange ? "نامعتبر" : `${toPersianDigits(durationMinutes)} دقیقه`}</em>
                      <div>
                        <span>تا ساعت</span>
                        <BreakTimeWheel
                          options={clockOptions}
                          value={endValue}
                          disabledValues={disabledEnds}
                          onChange={(slot) => onUpdateHour?.(selectedHour, { close_time: slot })}
                          ariaLabel={`ساعت پایان ${selectedHour.day}`}
                          idPrefix={`salon-hour-close-${selectedHour.day}`}
                          activeColor="#24143f"
                          inactiveColor="rgba(36, 20, 63, 0.26)"
                          disabledColor="rgba(36, 20, 63, 0.12)"
                        />
                      </div>
                    </div>
                    <div className="hoursCapacityControl settingsHoursCapacityControl">
                      <span>ظرفیت روز</span>
                      <div>
                        <button
                          type="button"
                          aria-label="کاهش ظرفیت"
                          disabled={Number(selectedHour.capacity || 0) <= 0}
                          onClick={() => onUpdateHour?.(selectedHour, {
                            capacity: Math.max(0, Number(selectedHour.capacity || 0) - 1)
                          })}
                        >
                          <Minus size={14} />
                        </button>
                        <b>{toPersianDigits(selectedHour.capacity || 0)}</b>
                        <button
                          type="button"
                          aria-label="افزایش ظرفیت"
                          onClick={() => onUpdateHour?.(selectedHour, {
                            capacity: Math.min(50, Number(selectedHour.capacity || 0) + 1)
                          })}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="hoursDayClosedNote">برای باز کردن این روز، کلید بالا را بزن.</p>
                )}
              </div>
            ) : null}

            <div className="hoursSummaryStrip settingsHoursSummaryStrip" aria-label="خلاصه هفته">
              <span><b>{toPersianDigits(openDaysCount)}</b> روز باز</span>
              <span><b>{toPersianDigits(weeklyCapacityTotal)}</b> ظرفیت هفته</span>
            </div>
          </article>
          <button
            type="button"
            className="settingsHoursClose"
            onClick={(event) => {
              event.stopPropagation();
              onToggleOpen?.();
            }}
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
