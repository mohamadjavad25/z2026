"use client";

import { Minus, Plus } from "lucide-react";

/** A number with − and + (owner's choice 2026-10-28: no typing numbers on a phone). `format` turns the value into text. */
export function Stepper({ value, onChange, min = 0, max = 100, step = 1, format = String, label }) {
  const set = (next) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="tsStepper" role="group" aria-label={label}>
      <button type="button" aria-label={`کمتر، ${label}`} disabled={value <= min} onClick={() => set(value - step)}><Minus size={16} aria-hidden="true" /></button>
      <output aria-live="polite">{format(value)}</output>
      <button type="button" aria-label={`بیشتر، ${label}`} disabled={value >= max} onClick={() => set(value + step)}><Plus size={16} aria-hidden="true" /></button>
    </div>
  );
}
