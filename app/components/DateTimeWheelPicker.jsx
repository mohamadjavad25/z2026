"use client";

import { BreakTimeWheel } from "./BreakTimeWheel";

/**
 * Day+time picker for booking flows -- renders inside the exact same
 * ".settingsHoursWheelRange" card the working-hours editor uses (see
 * SalonHoursEditor.jsx), not a lookalike copy of it. That one shell is the
 * single style source for every wheel-pair in the app now: this component
 * adds nothing of its own beyond the ".is-pair" column-count override
 * (two wheels, no duration badge between them -- day+time isn't a range
 * like start/end working hours are).
 *
 * dayOptions/timeOptions accept plain strings or {value, label} objects
 * (a rolling label like "امروز" against a real date-key value, say);
 * onDayChange always receives the option's value.
 */
export function DateTimeWheelPicker({
  dayOptions = [],
  dayValue = "",
  onDayChange,
  disabledDays = [],
  dayIdPrefix = "wheel-day",
  dayLabel = "روز",
  dayAriaLabel = "انتخاب روز",
  timeOptions = [],
  timeValue = "",
  onTimeChange,
  timeIdPrefix = "wheel-time",
  timeLabel = "ساعت",
  timeAriaLabel = "انتخاب ساعت",
  emptyTimeMessage = "نوبت آزادی نیست"
}) {
  const normalizedDayOptions = dayOptions.map((option) => (
    option && typeof option === "object"
      ? {
        value: String(option.value ?? option.day ?? option.label ?? ""),
        label: String(option.label ?? option.day ?? option.value ?? "")
      }
      : { value: String(option || ""), label: String(option || "") }
  )).filter((option) => option.value && option.label);
  const activeDayOption = normalizedDayOptions.find((option) => option.value === dayValue)
    || normalizedDayOptions.find((option) => option.label === dayValue)
    || normalizedDayOptions[0]
    || { value: dayValue, label: dayValue };
  const disabledDayLabels = normalizedDayOptions
    .filter((option) => disabledDays.includes(option.value) || disabledDays.includes(option.label))
    .map((option) => option.label);

  return (
    <div className="settingsHoursWheelRange is-pair">
      <div>
        <span>{dayLabel}</span>
        <BreakTimeWheel
          mode="label"
          idPrefix={dayIdPrefix}
          options={normalizedDayOptions.map((option) => option.label)}
          value={activeDayOption.label}
          disabledValues={disabledDayLabels}
          onChange={(label) => {
            const option = normalizedDayOptions.find((item) => item.label === label);
            onDayChange?.(option?.value || label);
          }}
          ariaLabel={dayAriaLabel}
        />
      </div>
      <div>
        <span>{timeLabel}</span>
        {timeOptions.length ? (
          <BreakTimeWheel
            mode="clock"
            idPrefix={timeIdPrefix}
            options={timeOptions}
            value={timeValue}
            onChange={onTimeChange}
            ariaLabel={timeAriaLabel}
          />
        ) : (
          <div className="artistPublicSlotEmpty">{emptyTimeMessage}</div>
        )}
      </div>
    </div>
  );
}
