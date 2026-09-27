"use client";

import { BreakTimeWheel } from "./BreakTimeWheel";

/**
 * The one shared "pick a day, pick a time" control for every booking flow
 * (the owner's own booking-create form, the client-facing direct-artist
 * booking panel, the client-facing salon booking modal). Each of these used
 * to compose its own copy of this day+time wheel pair with its own wrapper
 * markup/classNames -- which is exactly how they drifted into three
 * visually different-looking controls despite all wrapping the same
 * BreakTimeWheel. Change the look here once, everywhere that books a
 * day/time picks it up.
 *
 * dayOptions/timeOptions accept either plain strings or {value, label}
 * objects (day tabs sometimes carry a separate value/label, e.g. a rolling
 * "امروز"/"فردا" label against a real date-key value); onDayChange always
 * receives the option's value (falling back to its label if there's no
 * separate value).
 */
export function BookingDateTimeWheels({
  dayOptions = [],
  dayValue = "",
  onDayChange,
  disabledDays = [],
  dayIdPrefix = "booking-day",
  dayAriaLabel = "انتخاب روز رزرو",
  dayFieldName,
  dayLabel = "روز",
  timeOptions = [],
  timeValue = "",
  onTimeChange,
  timeIdPrefix = "booking-time",
  timeAriaLabel = "انتخاب ساعت رزرو",
  timeFieldName,
  timeLabel = "ساعت",
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
  const dayLabels = normalizedDayOptions.map((option) => option.label);
  const disabledDayLabels = normalizedDayOptions
    .filter((option) => disabledDays.includes(option.value) || disabledDays.includes(option.label))
    .map((option) => option.label);

  return (
    <div className="artistPublicBookingWheels bookingCreateWheels">
      <div className="artistPublicBookingDayPicker">
        <span>{dayLabel}</span>
        {dayFieldName ? <input type="hidden" name={dayFieldName} value={activeDayOption.value} /> : null}
        <BreakTimeWheel
          mode="label"
          idPrefix={dayIdPrefix}
          options={dayLabels}
          value={activeDayOption.label}
          disabledValues={disabledDayLabels}
          onChange={(label) => {
            const option = normalizedDayOptions.find((item) => item.label === label);
            onDayChange?.(option?.value || label);
          }}
          ariaLabel={dayAriaLabel}
        />
      </div>
      <div className="artistPublicBookingTimePicker">
        <span>{timeLabel}</span>
        {timeFieldName ? <input type="hidden" name={timeFieldName} value={timeValue} /> : null}
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
