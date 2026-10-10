"use client";

import { useMemo } from "react";
import { Bookmark, CalendarCheck, ChevronLeft, Clock3, Pencil, Phone } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { bookingStatusLabel, bookingStatusTone, isBookingActive, isBookingInPast, pickNextBooking } from "./bookingStatus";

/**
 * Client role — the "پروفایل" tab. Identity + a live summary of the client's
 * own activity (real counts from their bookings / saves) and shortcuts.
 * Everything that is a *setting* (notifications, location, logout, delete
 * account) lives only in the "تنظیمات" tab, so the two screens no longer
 * overlap.
 */
export function ClientProfileOverview({
  profile,
  bookings = [],
  savedCount = 0,
  onEditProfile,
  onOpenSaved,
  onOpenBookings
}) {
  const phone = profile?.data?.phone || "";

  const stats = useMemo(() => {
    let active = 0;
    let done = 0;
    bookings.forEach((booking) => {
      if (booking.status === "تایید شده" && isBookingInPast(booking)) done += 1;
      else if (isBookingActive(booking)) active += 1;
    });
    return { active, done };
  }, [bookings]);
  const next = useMemo(() => pickNextBooking(bookings), [bookings]);

  return (
    <section className="cpo" aria-label="پروفایل من">
      <article className="cpoCard">
        <span className="cpoCardIcon" aria-hidden="true"><Phone size={17} /></span>
        <div className="cpoCopy">
          <small>شماره تماس</small>
          <strong dir="ltr">{phone ? toPersianDigits(phone) : "ثبت نشده"}</strong>
        </div>
        <button type="button" className="cpoEdit" onClick={onEditProfile}>
          <Pencil size={14} /> ویرایش پروفایل
        </button>
      </article>

      <div className="cpoStats" aria-label="خلاصه فعالیت">
        <button type="button" onClick={onOpenBookings}><b>{toPersianDigits(stats.active)}</b><small>رزرو فعال</small></button>
        <button type="button" onClick={onOpenBookings}><b>{toPersianDigits(stats.done)}</b><small>انجام‌شده</small></button>
        <button type="button" onClick={onOpenSaved}><b>{toPersianDigits(savedCount)}</b><small>ذخیره‌شده</small></button>
      </div>

      {next ? (
        <button type="button" className="cpoNext" onClick={onOpenBookings}>
          <span className="cpoNextHead"><CalendarCheck size={15} /> نوبت بعدی من</span>
          <span className="cpoNextBody">
            <ServiceIcon emoji={next.service_emoji} name={next.service} size="md" />
            <div>
              <b>{next.service || "خدمت زیبایی"}</b>
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
          <small>نوبت فعالی نداری. از بخش «سالن» یک نوبت بگیر.</small>
        </button>
      )}

      <button type="button" className="cpoLink" onClick={onOpenSaved}>
        <span className="cpoLinkIcon"><Bookmark size={17} /></span>
        <span className="cpoLinkCopy">
          <strong>ذخیره‌شده‌ها</strong>
          <small>{savedCount ? `${toPersianDigits(savedCount)} مورد ذخیره‌شده` : "مدل‌ها و نمونه‌کارهای ذخیره‌شده"}</small>
        </span>
        <ChevronLeft size={16} />
      </button>
    </section>
  );
}
