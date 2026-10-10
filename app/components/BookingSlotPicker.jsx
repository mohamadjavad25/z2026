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
  closedDays = [],
  timeOptions = [],
  timeValue = "",
  onTimeChange,
  emptyTimeMessage = "برای این روز ساعتی آزاد نیست."
}) {
  const stripRef = useRef(null);
  const activeDayRef = useRef(null);

  // Keep the selected day in view when the strip is wider than the screen. Only the strip
  // scrolls, sideways: scrollIntoView would also scroll the sheet and hide its header.
  useEffect(() => {
    const strip = stripRef.current;
    const day = activeDayRef.current;
    if (!strip || !day || typeof strip.scrollBy !== "function") return;
    const stripBox = strip.getBoundingClientRect();
    const dayBox = day.getBoundingClientRect();
    strip.scrollBy({ left: (dayBox.left + dayBox.width / 2) - (stripBox.left + stripBox.width / 2) });
  }, [dayValue]);

  return (
    <div className="bsp">
      <div className="bspLabel">روز</div>
      <div className="bspDays" role="radiogroup" aria-label="انتخاب روز" ref={stripRef}>
        {dayOptions.map((label, index) => {
          const [weekday = "", dayNumber = "", ...month] = String(label).split(" ");
          const selected = label === dayValue;
          const closed = closedDays.includes(label);
          const disabled = closed || disabledDays.includes(label);
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
              <em>{closed ? "تعطیل" : disabled ? "پر" : month.join(" ")}</em>
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
