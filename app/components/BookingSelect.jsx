"use client";

import { useEffect, useId, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";

export function BookingSelect({
  label,
  name,
  value,
  options = [],
  onChange,
  placeholder,
  open = false,
  onOpenChange
}) {
  const rootRef = useRef(null);
  const listId = useId();
  const selected = options.find((item) => item.value === value) || options[0] || null;
  const fallbackText = placeholder || label || "انتخاب کن";

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) onOpenChange?.(false);
    }

    function onKeyDown(event) {
      if (event.key === "Escape") onOpenChange?.(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className={`bookingSelect ${open ? "is-open" : ""}`} ref={rootRef}>
      <input type="hidden" name={name} value={selected?.value || ""} />
      <button
        type="button"
        className="bookingSelectTrigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => onOpenChange?.(!open)}
      >
        <span className="bookingSelectValue">
          <b>{selected?.label || fallbackText}</b>
          {selected?.meta ? <small>{selected.meta}</small> : null}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="bookingSelectMenu" id={listId} role="listbox" aria-label={label}>
          {options.map((item) => {
            const active = item.value === (selected?.value || "");
            return (
              <button
                type="button"
                key={item.value}
                role="option"
                aria-selected={active}
                className={active ? "active" : ""}
                onClick={() => {
                  onChange?.(item.value);
                  onOpenChange?.(false);
                }}
              >
                <span className="bookingSelectOptionText">
                  <b>{item.label}</b>
                  {item.meta ? <small>{item.meta}</small> : null}
                </span>
                {active ? <Check size={14} aria-hidden="true" /> : <i />}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
