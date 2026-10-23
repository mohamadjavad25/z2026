"use client";

import { useState } from "react";
import { ChevronDown, Clock3 } from "lucide-react";
import { toPersianDigits } from "../shared/lib/digits";

const WEEK = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** Closed today: also say when it opens next («امروز تعطیل · فردا از ۱۰:۰۰»). */
function closedText(rows, todayName) {
  const start = WEEK.indexOf(todayName);
  if (start < 0) return "امروز تعطیل است";
  for (let step = 1; step < 7; step += 1) {
    const day = WEEK[(start + step) % 7];
    const row = rows.find((item) => item.day === day);
    if (row?.active) {
      const when = step === 1 ? "فردا" : day;
      return `امروز تعطیل · ${when} از ${toPersianDigits(row.open_time || "")}`;
    }
  }
  return "امروز تعطیل است";
}

/**
 * «ساعت کاری» of a public salon/artist page: one quiet row (today's hours) that opens the
 * whole week. It sits right under the intro, above the posts, so a long gallery can never
 * push it out of reach.
 */
export function WeeklyHours({ rows, todayName }) {
  const [open, setOpen] = useState(false);
  if (!Array.isArray(rows) || !rows.length) return null;
  const today = rows.find((row) => row.day === todayName);
  const todayText = today?.active
    ? `امروز ${toPersianDigits(today.open_time || "")} تا ${toPersianDigits(today.close_time || "")}`
    : closedText(rows, todayName);
  return (
    <section className="spvSection spvHours">
      <button type="button" className="spvHoursToggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Clock3 size={17} aria-hidden="true" />
        <b>ساعت کاری</b>
        <span>{todayText}</span>
        <ChevronDown size={17} className={`spvHoursChevron${open ? " is-open" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <ul>
          {rows.map((row) => (
            <li key={row.day} className={row.day === todayName ? "is-today" : ""}>
              <b>{row.day}</b>
              <span>{row.active ? `${toPersianDigits(row.open_time || "")} تا ${toPersianDigits(row.close_time || "")}` : "تعطیل"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
