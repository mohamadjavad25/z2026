"use client";

import { useEffect, useRef } from "react";
import { toLatinDigits, toPersianDigits } from "../shared/lib/digits";

/**
 * Day strip + time grid for client booking flows (replaces the scroll wheels: every option is
 * visible at once, one tap picks it, closed / full days are shown but disabled).
 *
 * dayOptions are labels like "یکشنبه ۱۲ مهر" (weekday, day number, month); the first one is today.
 * timeOptions are the free clock times for the selected day.
 */
export function BookingSlotPicker({
  dayOptions = [],
  dayValue = "",
  onDayChange,
  disabledDays = [],
  timeOptions = [],
  timeValue = "",
  onTimeChange,
  emptyTimeMessage = "برای این روز ساعتی آزاد نیست."
}) {
  const stripRef = useRef(null);
  const activeDayRef = useRef(null);

  // Keep the selected day in view when the strip is wider than the screen.
  useEffect(() => {
    activeDayRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [dayValue]);

  return (
    <div className="bsp">
      <div className="bspLabel">روز</div>
      <div className="bspDays" role="radiogroup" aria-label="انتخاب روز" ref={stripRef}>
        {dayOptions.map((label, index) => {
          const [weekday = "", dayNumber = "", ...month] = String(label).split(" ");
          const selected = label === dayValue;
          const disabled = disabledDays.includes(label);
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              key={label}
              ref={selected ? activeDayRef : null}
              className={`bspDay${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
              onClick={() => onDayChange?.(label)}
            >
              <small>{index === 0 ? "امروز" : weekday}</small>
              <b>{dayNumber}</b>
              <em>{disabled ? "پر" : month.join(" ")}</em>
            </button>
          );
        })}
      </div>

      <div className="bspLabel">ساعت</div>
      {timeOptions.length ? (
        <div className="bspTimes" role="radiogroup" aria-label="انتخاب ساعت">
          {timeOptions.map((time) => (
            <button
              type="button"
              role="radio"
              aria-checked={time === timeValue}
              key={time}
              className={`bspTime${time === timeValue ? " is-selected" : ""}`}
              onClick={() => onTimeChange?.(time)}
              dir="ltr"
            >
              {toPersianDigits(toLatinDigits(time))}
            </button>
          ))}
        </div>
      ) : (
        <p className="bspEmpty">{emptyTimeMessage}</p>
      )}
    </div>
  );
}
