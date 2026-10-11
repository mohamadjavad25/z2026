"use client";

import { useMemo } from "react";
import { CalendarCheck, Clock3 } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { bookingStatusLabel, bookingStatusTone, pickNextBooking } from "./bookingStatus";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

/**
 * Client role — the "پروفایل" tab: just the next visit. Phone, editing the
 * profile and saved posts live in the "تنظیمات" tab, and the full list of
 * bookings is "فعالیت من".
 */
export function ClientProfileOverview({ bookings = [], onOpenBookings }) {
  const next = useMemo(() => pickNextBooking(bookings), [bookings]);

  return (
    <section className="cpo" aria-label="پروفایل من">
      {next ? (
        <button type="button" className="cpoNext" onClick={onOpenBookings}>
          <span className="cpoNextHead"><CalendarCheck size={15} /> نوبت بعدی من</span>
          <span className="cpoNextBody">
            <ServiceIcon emoji={next.service_emoji} name={next.service} size="md" />
            <div>
              <b>{shortServiceLabel(next.service) || "خدمت زیبایی"}</b>
              <small>{next.salonName || next.salon_name || "سالن منتخب"}</small>
            </div>
            <em className={`is-${bookingStatusTone(next.status || "تازه")}`}>{bookingStatusLabel(next.status)}</em>
          </span>
          <span className="cpoNextWhen">
            <Clock3 size={14} />
            {formatRelativeBookingDayLabel(next.booking_date || next.date || "امروز")}
            {next.time ? ` • ${toPersianDigits(next.time)}` : ""}
          </span>
        </button>
      ) : (
        <button type="button" className="cpoNext is-empty" onClick={onOpenBookings}>
          <span className="cpoNextHead"><CalendarCheck size={15} /> نوبت بعدی من</span>
          <small>نوبت فعالی نداری. از بخش «رزرو» یک نوبت بگیر.</small>
        </button>
      )}
    </section>
  );
}
