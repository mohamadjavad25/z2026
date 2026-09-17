"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, CheckCircle2, Clock3, FileText, MapPin, RotateCcw, Sparkles } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import {
  buildExactBookingDateTabs,
  getBookingDateKey,
  isArtistBookingOnExactDate
} from "../artist";
import { ProfileHeroWeekStrip } from "../profile/ProfileHeroWeekStrip";

/**
 * Client role — bookings list on profile bookings tab.
 * Presentational: booking rows + open-settings callback (list from useSalonDirectory).
 */
export function ClientBookingsPanel({ bookings = [], onOpenSettings }) {
  const weekTabs = useMemo(() => {
    const fallbackTabs = buildExactBookingDateTabs(7);
    const seen = new Set();
    const bookingTabs = bookings
      .map((booking) => {
        const rawDate = booking.booking_date || booking.date || "";
        const dateKey = getBookingDateKey(rawDate || "امروز");
        if (!dateKey || seen.has(dateKey)) return null;
        seen.add(dateKey);
        const matchedFallback = fallbackTabs.find((tab) => tab.dateKey === dateKey);
        return {
          id: dateKey,
          day: matchedFallback?.label || rawDate || "امروز",
          label: matchedFallback?.label || rawDate || "امروز",
          meta: matchedFallback?.sub || rawDate || "",
          state: `${toPersianDigits(bookings.filter((item) => isArtistBookingOnExactDate(item, dateKey)).length)} نوبت`,
          dateKey
        };
      })
      .filter(Boolean);

    return (bookingTabs.length ? bookingTabs : fallbackTabs.map((tab) => ({
      id: tab.dateKey,
      day: tab.label,
      label: tab.label,
      meta: tab.sub || "",
      state: `${toPersianDigits(bookings.filter((item) => isArtistBookingOnExactDate(item, tab.dateKey)).length)} نوبت`,
      dateKey: tab.dateKey
    })));
  }, [bookings]);

  const [selectedDay, setSelectedDay] = useState("");
  const activeDay = selectedDay || weekTabs[0]?.id || weekTabs[0]?.day || "";
  const activeDateKey = weekTabs.find((tab) => (tab.id || tab.day) === activeDay)?.dateKey || "";
  const activeBookings = useMemo(() => (
    activeDateKey
      ? bookings.filter((booking) => isArtistBookingOnExactDate(booking, activeDateKey))
      : bookings
  ), [bookings, activeDateKey]);
  const [nextBooking, ...otherBookings] = activeBookings;

  const getBookingMeta = (booking) => {
    const salonName = booking.salonName || booking.salon_name || "سالن منتخب";
    const avatar = booking.salonAvatar || booking.salon_avatar || "";
    return {
      salonName,
      avatar,
      service: booking.service || "خدمت زیبایی",
      date: booking.booking_date || booking.date || "امروز",
      time: booking.time || "زمان",
      status: booking.status || "تایید شده"
    };
  };

  return (
    <section className="clientBookingsBoard" aria-label="رزروهای مشتری">
      <div className="boardHead">
        <div>
          <span>رزروهای من</span>
          <strong>نوبت‌های ثبت‌شده</strong>
        </div>
        <b>{toPersianDigits(bookings.length)} رزرو</b>
      </div>
      {bookings.length ? (
        <div className="clientBookingList">
          <ProfileHeroWeekStrip
            items={weekTabs}
            selectedDay={activeDay}
            defaultDay={weekTabs[0]?.id || weekTabs[0]?.day}
            onSelectDay={setSelectedDay}
            onOpenHistory={() => setSelectedDay(weekTabs[0]?.id || weekTabs[0]?.day || "")}
            ariaLabel="روزهای رزروهای من"
          />
          {nextBooking ? (() => {
            const meta = getBookingMeta(nextBooking);
            return (
              <article className="clientBookingFeatureCard" key={nextBooking.id || `${meta.salonName}-${meta.time}`}>
                <div className="clientBookingFeatureTop">
                  <span className={`clientBookingFeatureLogo ${meta.avatar ? "hasImage" : ""}`} aria-hidden="true">
                    {meta.avatar ? <img src={meta.avatar} alt="" /> : String(meta.salonName).slice(0, 1)}
                  </span>
                  <div>
                    <b>{meta.service}</b>
                    <span>{meta.salonName}</span>
                  </div>
                </div>
                <div className="clientBookingFeatureGrid">
                  <span>
                    <CalendarDays size={17} />
                    <small>تاریخ</small>
                    <b>{meta.date}</b>
                  </span>
                  <span>
                    <Clock3 size={17} />
                    <small>ساعت</small>
                    <SegmentClock value={meta.time} size="xs" as="b" backgroundColor="transparent" />
                  </span>
                </div>
                <div className="clientBookingStatusPill">
                  <CheckCircle2 size={16} />
                  {meta.status}
                </div>
                <div className="clientBookingFeatureActions">
                  <button type="button" onClick={() => onOpenSettings?.({ ...nextBooking, clientBookingSheetMode: "details" })}>
                    <FileText size={18} />
                    مشاهده جزئیات
                  </button>
                  <button type="button" onClick={() => onOpenSettings?.({ ...nextBooking, clientBookingSheetMode: "change" })}>
                    <RotateCcw size={18} />
                    تغییر یا لغو نوبت
                  </button>
                </div>
              </article>
            );
          })() : null}

          {otherBookings.length ? (
            <div className="clientBookingOtherList" aria-label="سایر نوبت‌ها">
              <span>سایر نوبت‌ها</span>
              {otherBookings.map((booking, index) => {
                const meta = getBookingMeta(booking);
                return (
                  <button
                    type="button"
                    className="clientBookingMiniCard"
                    key={booking.id || `${meta.salonName}-${meta.time}-${index}`}
                    onClick={() => onOpenSettings?.(booking)}
                  >
                    <span className={`clientBookingMiniLogo ${meta.avatar ? "hasImage" : ""}`} aria-hidden="true">
                      {meta.avatar ? <img src={meta.avatar} alt="" /> : String(meta.salonName).slice(0, 1)}
                    </span>
                    <div>
                      <b>{meta.service}</b>
                      <small>{meta.salonName} · {meta.date}</small>
                    </div>
                    <div className="clientBookingMiniState">
                      <strong>{meta.status}</strong>
                      <em>{meta.time}</em>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : activeBookings.length === 0 ? (
            <div className="clientBookingsEmpty is-dayEmpty">
              <CalendarCheck size={24} />
              <b>برای این روز نوبتی نداری</b>
              <span>از نوار بالا تاریخ‌های دیگر را ببین.</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="clientBookingsEmpty">
          <div className="clientBookingsEmptyArt" aria-hidden="true">
            <span className="clientBookingsEmptyGlow is-soft" />
            <span className="clientBookingsEmptyGlow is-deep" />
            <span className="clientBookingsEmptyOrb is-calendar">
              <CalendarCheck size={24} />
            </span>
            <span className="clientBookingsEmptyOrb is-pin">
              <MapPin size={18} />
            </span>
            <span className="clientBookingsEmptyOrb is-spark">
              <Sparkles size={18} />
            </span>
            <span className="clientBookingsEmptyPath" />
            <span className="clientBookingsEmptyCard is-main">
              <i />
              <b />
              <em />
            </span>
            <span className="clientBookingsEmptyCard is-mini">
              <i />
              <b />
            </span>
            <span className="clientBookingsEmptyTime">
              <Clock3 size={17} />
            </span>
          </div>
          <b>هنوز رزروی ثبت نشده</b>
          <span>بعد از رزرو سالن، نوبت‌ها اینجا نمایش داده می‌شوند.</span>
        </div>
      )}
    </section>
  );
}
