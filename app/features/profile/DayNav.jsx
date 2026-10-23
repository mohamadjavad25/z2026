"use client";

import { useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const SWIPE_MIN_PX = 48;

/**
 * The day at the top of a salon's or artist's bookings (owner's choice 2026-10-23, replacing the floating
 * strip): the day in the middle with how many bookings it has, the day before on the right and the day
 * after on the left (right-to-left), and a finger swipe does the same. Tapping the day itself opens the
 * full calendar (`onOpenCalendar`). Away from today, «امروز» brings it back.
 *
 * `items`: the same rolling days the old strip used ({ day, label, meta, state, isToday }).
 * `useDaySwipe` gives the same swipe to the list under it.
 */
export function DayNav({ items = [], selectedDay = "", onSelectDay, onOpenCalendar }) {
  const { index, go, dir, swipe } = useDayStep(items, selectedDay, onSelectDay);
  const current = items[index];
  if (!current) return null;
  const todayIndex = items.findIndex((item) => item.isToday);
  const title = current.isToday ? `امروز، ${current.label}` : `${current.label} ${current.meta || ""}`.trim();
  return (
    <div className="dayNav" {...swipe}>
      <button type="button" className="dayNavStep" onClick={() => go(-1)} disabled={index <= 0} aria-label="روز قبل">
        <ChevronRight size={20} aria-hidden="true" />
      </button>
      <button type="button" className="dayNavDay" onClick={onOpenCalendar} aria-label={`${title}، ${current.state || ""}. باز کردن تقویم`}>
        <span key={current.day} className={`dayNavText${dir ? ` is-from-${dir}` : ""}`}>
          <b>{title}</b>
          <small>{current.state}</small>
        </span>
        <CalendarDays size={17} className="dayNavCal" aria-hidden="true" />
      </button>
      <button type="button" className="dayNavStep" onClick={() => go(1)} disabled={index >= items.length - 1} aria-label="روز بعد">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      {todayIndex >= 0 && todayIndex !== index ? (
        <button type="button" className="dayNavToday" onClick={() => go(todayIndex - index)}>برگرد به امروز</button>
      ) : null}
    </div>
  );
}

/** Swipe handlers for the day's list, so a sideways swipe anywhere on it changes the day too. */
export function useDaySwipe(items, selectedDay, onSelectDay) {
  return useDayStep(items, selectedDay, onSelectDay).swipe;
}

function useDayStep(items, selectedDay, onSelectDay) {
  const [dir, setDir] = useState("");
  const start = useRef(null);
  let index = items.findIndex((item) => item.day === selectedDay || item.dateKey === selectedDay);
  if (index < 0) index = Math.max(0, items.findIndex((item) => item.isToday));
  const go = (step) => {
    const next = items[index + step];
    if (!next || !step) return;
    setDir(step > 0 ? "next" : "prev");
    onSelectDay?.(next.day);
  };
  const swipe = {
    onTouchStart: (event) => {
      const touch = event.touches[0];
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (event) => {
      const from = start.current;
      start.current = null;
      const touch = event.changedTouches[0];
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      // Right-to-left: pulling the page to the left brings the next day in from the left side.
      go(dx < 0 ? 1 : -1);
    }
  };
  return { index, go, dir, swipe };
}
