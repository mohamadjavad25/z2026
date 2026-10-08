"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Salon owner's day picker, tucked away by default: a small pill above the bottom bar that names what it is
 * ("برنامه روزها") and which day is selected, and opens the full strip on tap. Keeps the page uncluttered
 * while still telling the owner what it does.
 */
export function SalonWeekStripDock({ items = [], selectedDay = "", children }) {
  const [open, setOpen] = useState(false);
  const current = items.find((item) => item.day === selectedDay || item.id === selectedDay) || items.find((item) => item.isToday);
  const dayText = current ? [current.label, current.meta].filter(Boolean).join(" · ") : "";

  return (
    <div className={`weekDock${open ? " is-open" : ""}`}>
      {open ? (
        <>
          <button type="button" className="weekDockClose" onClick={() => setOpen(false)} aria-label="بستن برنامه روزها">
            <ChevronDown size={18} />
          </button>
          {children}
        </>
      ) : (
        <button
          type="button"
          className="weekDockPill"
          onClick={() => setOpen(true)}
          aria-expanded="false"
          aria-label={`برنامه روزها، ${dayText}. برای دیدن رزروهای هر روز باز کن`}
        >
          <CalendarDays size={18} aria-hidden="true" />
          <span><b>برنامه روزها</b><small>{dayText || "رزروهای هر روز"}</small></span>
          <ChevronUp size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
