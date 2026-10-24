"use client";

import { useState } from "react";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { usePolling } from "../../shared/lib/usePolling";
import { getSalonDirectVisits } from "../../shared/api/salons";

const SHOWN = 6;

/**
 * Salon owner — the clients the team's artists receive at the salon from their own pages (owner's idea of 2026-10-24).
 * Only when, how long and which artist: those hours are already taken in the artist's calendar, and the client's name
 * and number stay with the artist until the client connects to the salon. Renders nothing while there are none.
 */
export function SalonDirectVisits() {
  const [visits, setVisits] = useState([]);
  usePolling(async () => {
    const { ok, data } = await getSalonDirectVisits();
    if (ok && Array.isArray(data?.visits)) setVisits(data.visits);
  }, 30000);

  if (!visits.length) return null;
  const rest = visits.length - SHOWN;
  return (
    <section className="plVisits" aria-label="مشتری‌های مستقیم تیم">
      <h3>مشتری‌های مستقیمِ تیم</h3>
      <p>آرتیست‌هات از صفحهٔ خودشون نوبت گرفتن. اسم مشتری دیده نمی‌شه.</p>
      {visits.slice(0, SHOWN).map((visit) => (
        <div className="plVisit" key={visit.id}>
          <b>نوبت شخصی {visit.artistName}</b>
          <span>
            {formatRelativeBookingDayLabel(visit.date)}، ساعت {toPersianDigits(toLatinDigits(visit.time))}
            {visit.service ? `، ${visit.service}` : ""}
          </span>
        </div>
      ))}
      {rest > 0 ? <p>و {toPersianDigits(rest)} تای دیگه</p> : null}
    </section>
  );
}
