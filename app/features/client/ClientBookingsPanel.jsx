"use client";

import { useMemo, useState } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { CalendarCheck, CalendarDays, CheckCircle2, Clock3, FileText, Sparkles, TimerOff, XCircle } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { formatRequestExpiryDeadline } from "../../shared/lib/time";
import {
  buildExactBookingDateTabs,
  getBookingDateKey,
  isArtistBookingOnExactDate
} from "../artist";
import { BookingHistoryCalendarSheet } from "../profile/BookingHistoryCalendarSheet";
import { ProfileHeroWeekStrip } from "../profile/ProfileHeroWeekStrip";
import { bookingStatusLabel, bookingStatusTone } from "./bookingStatus";

const BOOKING_STATUS_ICONS = {
  pending: Clock3,
  done: CheckCircle2,
  bad: XCircle,
  expired: TimerOff
};

// Same rule as ClientBookingSettingsModal's isBookingSettled (duplicated,
// not shared — small component-local helper, matching this codebase's
// convention): "رزرو دوباره" only makes sense once this booking is settled,
// not while it's still an active pending/upcoming one.
function isBookingSettled(booking) {
  const status = booking?.status || "";
  if (status === "لغو" || status === "منقضی شده") return true;
  if (status !== "تایید شده") return false;
  const rawDate = booking?.booking_date || booking?.date || "";
  if (!rawDate) return false;
  const bookingDate = resolveRollingPersianDate(rawDate);
  const today = resolveRollingPersianDate("امروز");
  return bookingDate.getTime() <= today.getTime();
}

/**
 * Client role — bookings list on profile bookings tab.
 * Presentational: booking rows + open-settings callback (list from useSalonDirectory).
 */
export function ClientBookingsPanel({ bookings = [], onOpenSettings, onRebook }) {
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
        const formattedFallbackLabel = rawDate ? formatRelativeBookingDayLabel(rawDate) : "امروز";
        return {
          id: dateKey,
          day: matchedFallback?.label || formattedFallbackLabel,
          label: matchedFallback?.label || formattedFallbackLabel,
          meta: matchedFallback?.sub || formattedFallbackLabel,
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
  const [historyOpen, setHistoryOpen] = useState(false);
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
    const rawDate = booking.booking_date || booking.date || "";
    return {
      salonName,
      avatar,
      service: booking.service || "خدمت زیبایی",
      serviceEmoji: booking.service_emoji || "",
      date: rawDate ? formatRelativeBookingDayLabel(rawDate) : "امروز",
      time: booking.time || "زمان",
      status: bookingStatusLabel(booking.status),
      tone: bookingStatusTone(booking.status || "تازه")
    };
  };

  return (
    <>
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
            onOpenHistory={() => setHistoryOpen(true)}
            ariaLabel="روزهای رزروهای من"
          />
          {nextBooking ? (() => {
            const meta = getBookingMeta(nextBooking);
            const StatusIcon = BOOKING_STATUS_ICONS[meta.tone] || Clock3;
            const pendingDeadline = (nextBooking.status === "درخواست" || nextBooking.status === "تازه")
              ? formatRequestExpiryDeadline(nextBooking.created_at)
              : "";
            return (
              <article
                className="clientBookingFeatureCard is-clickable"
                key={nextBooking.id || `${meta.salonName}-${meta.time}`}
                onClick={() => onOpenSettings?.({ ...nextBooking, clientBookingSheetMode: "details" })}
              >
                <div className="clientBookingFeatureTop">
                  <ServiceIcon emoji={meta.serviceEmoji} name={meta.service} size="lg" className="clientBookingFeatureIcon" />
                  <div>
                    <b>{meta.service}</b>
                    <span>{meta.salonName}</span>
                  </div>
                  <span className={`clientBookingFeatureLogo ${meta.avatar ? "hasImage" : ""}`} aria-hidden="true">
                    {meta.avatar ? <img src={meta.avatar} alt="" /> : String(meta.salonName).slice(0, 1)}
                  </span>
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
                <div className={`clientBookingStatusPill is-${meta.tone}`}>
                  <StatusIcon size={16} />
                  {meta.status}
                </div>
                {pendingDeadline ? (
                  <p className="clientBookingPendingNote">
                    <Clock3 size={14} />
                    در انتظار تایید سالن — حداکثر تا ساعت {pendingDeadline}
                  </p>
                ) : null}
                <div className="clientBookingFeatureActions">
                  <button
                    type="button"
                    className="clientBookingActionPrimary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenSettings?.({ ...nextBooking, clientBookingSheetMode: "details" });
                    }}
                  >
                    <FileText size={17} />
                    مشاهده جزئیات
                  </button>
                  {isBookingSettled(nextBooking) ? (
                    <button
                      type="button"
                      className="clientBookingActionSecondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRebook?.(nextBooking);
                      }}
                      aria-label="رزرو دوباره"
                      title="رزرو دوباره"
                    >
                      <Sparkles size={18} />
                    </button>
                  ) : null}
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
                      <b className="svcInline"><ServiceIcon emoji={meta.serviceEmoji} name={meta.service} size="xs" />{meta.service}</b>
                      <small>{meta.salonName} · {meta.date}</small>
                    </div>
                    <div className="clientBookingMiniState">
                      <strong className={`is-${meta.tone}`}>{meta.status}</strong>
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
          <img
            className="clientBookingsEmptyArt"
            src="/client-bookings-empty.png"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <b>هنوز رزروی ثبت نشده</b>
          <span>بعد از رزرو سالن، نوبت‌ها اینجا نمایش داده می‌شوند.</span>
        </div>
      )}
    </section>
    <BookingHistoryCalendarSheet
      open={historyOpen}
      onOpenChange={setHistoryOpen}
      selectedDay={activeDateKey}
      onSelectDay={setSelectedDay}
      bookings={bookings}
      matchBookingDay={(booking, dateKey) => isArtistBookingOnExactDate(booking, dateKey)}
      kicker="رزرو"
      title="تاریخچه رزروها"
      emptyDayLabel="رزروی ثبت نشده"
      renderBooking={(booking, { closeHistory }) => {
        const meta = getBookingMeta(booking);
        return (
          <button
            type="button"
            className="clientBookingMiniCard"
            onClick={() => {
              closeHistory?.();
              onOpenSettings?.({ ...booking, clientBookingSheetMode: "details" });
            }}
          >
            <span className={`clientBookingMiniLogo ${meta.avatar ? "hasImage" : ""}`} aria-hidden="true">
              {meta.avatar ? <img src={meta.avatar} alt="" /> : String(meta.salonName).slice(0, 1)}
            </span>
            <div>
              <b className="svcInline"><ServiceIcon emoji={meta.serviceEmoji} name={meta.service} size="xs" />{meta.service}</b>
              <small>{meta.salonName} · {meta.date}</small>
            </div>
            <div className="clientBookingMiniState">
              <strong className={`is-${meta.tone}`}>{meta.status}</strong>
              <em>{meta.time}</em>
            </div>
          </button>
        );
      }}
    />
    </>
  );
}
