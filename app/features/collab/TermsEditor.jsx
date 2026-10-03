"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { buildClockOptions } from "../../shared/lib/time";
import { CAPACITY_PRESETS, HOUR_RANGE_PRESETS, NEGOTIABLE, PresetRow, SHARE_PRESETS } from "./collabPresets";

export const WEEKDAYS = [
  { value: "شنبه", short: "ش" },
  { value: "یکشنبه", short: "ی" },
  { value: "دوشنبه", short: "د" },
  { value: "سه‌شنبه", short: "س" },
  { value: "چهارشنبه", short: "چ" },
  { value: "پنجشنبه", short: "پ" },
  { value: "جمعه", short: "ج" }
];

export function parseDays(text) {
  const parts = String(text || "").split(/[،,]/).map((item) => item.trim());
  return WEEKDAYS.filter((day) => parts.includes(day.value)).map((day) => day.value);
}

export function serializeDays(list) {
  return WEEKDAYS.filter((day) => list.includes(day.value)).map((day) => day.value).join("، ");
}

/** Minimal styled dropdown — replaces the native <select>'s OS-rendered popup. */
export function TimeSelect({ value, options, onChange, label }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div className={`collabTimeSelect ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="collabTimeSelectTrigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{value}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="collabTimeSelectMenu" role="listbox" aria-label={label}>
          {options.map((slot) => (
            <button
              type="button"
              key={slot}
              role="option"
              aria-selected={slot === value}
              className={`collabTimeSelectOption ${slot === value ? "is-selected" : ""}`}
              onClick={() => {
                onChange(slot);
                setOpen(false);
              }}
            >
              {slot}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One-line human summary of the terms, shown live under the editor. */
export function summarizeTerms({ days, from, to, share, capacity }) {
  const dayList = parseDays(days);
  const dayText = dayList.length === 7 ? "هر روز" : dayList.join("، ");
  return [
    dayText,
    from && to ? `${from} تا ${to}` : "",
    share ? (share === NEGOTIABLE ? "سهم توافقی" : `${share}٪ سهم آرتیست`) : "",
    capacity ? (capacity === NEGOTIABLE ? "ظرفیت توافقی" : `${capacity} نفر در روز`) : ""
  ].filter(Boolean).join(" · ");
}

/** Read-only chips for terms — used on invites, proposals and team cards. */
export function TermsChips({ days, from, to, share, capacity }) {
  const items = [
    days ? { key: "d", text: days } : null,
    from && to ? { key: "t", text: `${from} تا ${to}` } : null,
    share ? { key: "s", text: share === NEGOTIABLE ? "سهم توافقی" : `${share}٪ سهم` } : null,
    capacity ? { key: "c", text: capacity === NEGOTIABLE ? "ظرفیت توافقی" : `ظرفیت ${capacity}` } : null
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="clTermsChips">
      {items.map((item) => <span key={item.key}>{item.text}</span>)}
    </div>
  );
}

/**
 * Shared collaboration-terms editor (artist proposal form). Weekday toggle
 * chips + time selects + share/capacity presets with a live summary, so the
 * artist never types a free-form schedule.
 */
export function TermsEditor({ value, onChange }) {
  const selectedDays = parseDays(value.days);
  const toggleDay = (day) => {
    const next = selectedDays.includes(day) ? selectedDays.filter((item) => item !== day) : [...selectedDays, day];
    onChange({ days: serializeDays(next) });
  };
  const summary = summarizeTerms(value);

  return (
    <div className="clTerms">
      <div className="clField">
        <span>روزهای حضور</span>
        <div className="clDays" role="group" aria-label="روزهای حضور">
          {WEEKDAYS.map((day) => (
            <button
              type="button"
              key={day.value}
              className={`clDay ${selectedDays.includes(day.value) ? "is-on" : ""}`}
              aria-pressed={selectedDays.includes(day.value)}
              aria-label={day.value}
              title={day.value}
              onClick={() => toggleDay(day.value)}
            >
              {day.short}
            </button>
          ))}
        </div>
      </div>
      <div className="clField">
        <span>ساعت کاری</span>
        <div className="collabFormRow">
          <TimeSelect
            value={value.from}
            options={buildClockOptions(8 * 60, 21 * 60, 60)}
            onChange={(slot) => onChange({ from: slot })}
            label="ساعت شروع"
          />
          <TimeSelect
            value={value.to}
            options={buildClockOptions(9 * 60, 23 * 60, 60)}
            onChange={(slot) => onChange({ to: slot })}
            label="ساعت پایان"
          />
        </div>
        <PresetRow
          options={HOUR_RANGE_PRESETS.map((item) => ({ label: item.label, value: item.label }))}
          isSelected={(label) => HOUR_RANGE_PRESETS.some((item) => item.label === label && item.from === value.from && item.to === value.to)}
          onPick={(label) => {
            const range = HOUR_RANGE_PRESETS.find((item) => item.label === label);
            if (range) onChange({ from: range.from, to: range.to });
          }}
        />
      </div>
      <div className="clField">
        <span>سهم آرتیست</span>
        <PresetRow
          options={SHARE_PRESETS}
          isSelected={(item) => value.share === item}
          onPick={(item) => onChange({ share: item })}
        />
      </div>
      <div className="clField">
        <span>ظرفیت روزانه (نفر)</span>
        <PresetRow
          options={CAPACITY_PRESETS}
          isSelected={(item) => value.capacity === item}
          onPick={(item) => onChange({ capacity: item })}
        />
      </div>
      {summary ? <p className="clSummary" aria-live="polite">{toPersianDigits(summary)}</p> : null}
    </div>
  );
}
