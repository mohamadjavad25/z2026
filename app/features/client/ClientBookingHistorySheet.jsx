"use client";

import { useMemo, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { bookingStatusLabel, bookingStatusTone } from "./bookingStatus";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

const FILTERS = [
  { id: "all", label: "همه" },
  { id: "done", label: "انجام‌شده" },
  { id: "bad", label: "لغو و منقضی" }
];

const dayKeyOf = (booking) => booking.booking_date || booking.date || "";
const timeOf = (booking) => (dayKeyOf(booking) ? resolveRollingPersianDate(dayKeyOf(booking)).getTime() : 0);

/**
 * The client's booking history: everything that is over, cancelled or expired, newest first and
 * grouped by day. Tap a row for its details, or the arrow to book the same thing again.
 */
export function ClientBookingHistorySheet({ open, onClose, bookings = [], onOpenBooking, onRebook }) {
  const [filter, setFilter] = useState("all");

  const groups = useMemo(() => {
    const wanted = bookings.filter((booking) => {
      const tone = bookingStatusTone(booking.status || "تازه");
      if (filter === "done") return tone === "done";
      if (filter === "bad") return tone === "bad" || tone === "expired";
      return true;
    });
    const sorted = [...wanted].sort((a, b) => timeOf(b) - timeOf(a));
    const byDay = new Map();
    sorted.forEach((booking) => {
      const key = dayKeyOf(booking) || "—";
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(booking);
    });
    return [...byDay.entries()];
  }, [bookings, filter]);

  return (
    <ProfileSheet open={open} kicker="رزروهای من" title="سابقه رزروها" panelClassName="cbhSheet" onClose={onClose}>
      <div className="cbhBody">
        <div className="cbhChips" role="tablist" aria-label="فیلتر سابقه">
          {FILTERS.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              aria-selected={filter === item.id}
              className={filter === item.id ? "is-on" : ""}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {groups.length === 0 ? (
          <div className="cbhEmpty">
            <History size={26} />
            <b>{bookings.length ? "موردی با این فیلتر نیست" : "هنوز سابقه‌ای نداری"}</b>
            <span>{bookings.length ? "فیلتر دیگری را امتحان کن." : "رزروهای انجام‌شده، لغوشده و منقضی اینجا جمع می‌شوند."}</span>
          </div>
        ) : (
          groups.map(([day, items]) => (
            <section className="cbhGroup" key={day}>
              <h4>{day === "—" ? "بدون تاریخ" : formatRelativeBookingDayLabel(day)}</h4>
              <ul>
                {items.map((booking, index) => {
                  const tone = bookingStatusTone(booking.status || "تازه");
                  const place = booking.salonName || booking.salon_name || "سالن";
                  return (
                    <li key={`${booking.bookingSource || "salon"}-${booking.id || index}`}>
                      <button type="button" className="cbhRow" onClick={() => onOpenBooking?.(booking)}>
                        <ServiceIcon emoji={booking.service_emoji} name={booking.service} size="sm" />
                        <span className="cbhRowText">
                          <b>{shortServiceLabel(booking.service) || "خدمت زیبایی"}</b>
                          <small>{place}{booking.time ? ` • ${toPersianDigits(booking.time)}` : ""}</small>
                        </span>
                        <em className={`is-${tone}`}>{bookingStatusLabel(booking.status)}</em>
                      </button>
                      <button
                        type="button"
                        className="cbhAgain"
                        onClick={() => onRebook?.(booking)}
                        aria-label="رزرو دوباره"
                        title="رزرو دوباره"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </ProfileSheet>
  );
}
