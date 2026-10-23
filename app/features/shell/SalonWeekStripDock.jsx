"use client";

import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Salon owner's day picker, tucked away by default. Two pieces that share one open state (useHomeChrome):
 *  - `mode="pill"`: a small pill at the top of the day's bookings (ProfilePanelBody), in the page's flow so it
 *    never covers the list (2026-10-23), naming which day is selected; a tap opens the strip.
 *  - `mode="strip"`: the full week strip, floating above the bottom bar while open (MobileFloatingCta).
 */
export function SalonWeekStripDock({ mode = "pill", open = false, onOpenChange, items = [], selectedDay = "", children }) {
  const current = items.find((item) => item.day === selectedDay || item.id === selectedDay) || items.find((item) => item.isToday);
  const dayText = current ? [current.label, current.meta].filter(Boolean).join(" · ") : "";

  if (mode === "strip") {
    return (
      <div className="weekDock is-open">
        <button type="button" className="weekDockClose" onClick={() => onOpenChange?.(false)} aria-label="بستن برنامه روزها">
          <ChevronDown size={18} />
        </button>
        {children}
      </div>
    );
  }

  return (
    <div className="weekDock">
      <button
        type="button"
        className="weekDockPill"
        onClick={() => onOpenChange?.(!open)}
        aria-expanded={open}
        aria-label={`برنامه روز: ${dayText}. برای دیدن رزروهای هر روز باز کن`}
      >
        <CalendarDays size={18} aria-hidden="true" />
        <span>{dayText || "امروز"}</span>
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}
