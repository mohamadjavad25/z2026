"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarDays, Clock3, FileText, History, Sparkles } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Mascot } from "../../components/Mascot";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { formatRequestExpiryDeadline } from "../../shared/lib/time";
import { ClientBookingHistorySheet } from "./ClientBookingHistorySheet";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import {
  bookingStatusLabel,
  bookingStatusTone,
  isBookingActive,
  isBookingInPast
} from "./bookingStatus";

// "رزرو دوباره" only makes sense once this specific booking is settled — cancelled / expired
// outright, or confirmed and its date has already passed. Not while it is still pending or upcoming.
function isBookingSettled(booking) {
  const status = booking?.status || "";
  if (status === "لغو" || status === "منقضی شده") return true;
  if (status !== "تایید شده") return false;
  const rawDate = booking?.booking_date || booking?.date || "";
  if (!rawDate) return false;
  return resolveRollingPersianDate(rawDate).getTime() <= resolveRollingPersianDate("امروز").getTime();
}

function dayOf(booking) {
  return booking.booking_date || booking.date || "";
}

/** Earliest first: by date, then by clock time. */
function compareUpcoming(a, b) {
  const da = dayOf(a) ? resolveRollingPersianDate(dayOf(a)).getTime() : 0;
  const db = dayOf(b) ? resolveRollingPersianDate(dayOf(b)).getTime() : 0;
  if (da !== db) return da - db;
  return String(a.time || "").localeCompare(String(b.time || ""));
}

function metaOf(booking) {
  const rawDate = dayOf(booking);
  return {
    salonName: booking.salonName || booking.salon_name || "سالن منتخب",
    avatar: booking.salonAvatar || booking.salon_avatar || "",
    service: booking.service || "خدمت زیبایی",
    serviceEmoji: booking.service_emoji || "",
    date: rawDate ? formatRelativeBookingDayLabel(rawDate) : "امروز",
    time: booking.time || "زمان",
    status: bookingStatusLabel(booking.status),
    tone: bookingStatusTone(booking.status || "تازه")
  };
}

/**
 * Client role — "فعالیت من". Shows what is still ahead (the next appointment as a big card, the
 * rest as a short list); everything that is over, cancelled or expired lives behind the history
 * button. No day strip: a client has a handful of bookings, not a schedule to page through.
 */
export function ClientBookingsPanel({ bookings = [], onOpenSettings, onRebook }) {
  const [historyOpen, setHistoryOpen] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const ahead = [];
    const behind = [];
    bookings.forEach((booking) => {
      if (isBookingActive(booking) && !isBookingInPast(booking)) ahead.push(booking);
      else behind.push(booking);
    });
    return { upcoming: ahead.sort(compareUpcoming), past: behind };
  }, [bookings]);

  const [nextBooking, ...otherBookings] = upcoming;

  return (
    <>
      <section className="clientBookingsBoard" aria-label="رزروهای مشتری">
        <div className="boardHead cbpHead">
          <div>
            <span>رزروهای من</span>
            <strong>{upcoming.length ? "نوبت‌های پیش‌رو" : "نوبت پیش‌رویی نداری"}</strong>
          </div>
          <button
            type="button"
            className="cbpHistoryBtn"
            onClick={() => setHistoryOpen(true)}
            aria-label={`سابقه رزروها، ${toPersianDigits(past.length)} مورد`}
          >
            <History size={18} />
            <span>سابقه</span>
            {past.length ? <b>{toPersianDigits(past.length)}</b> : null}
          </button>
        </div>

        {nextBooking ? (() => {
          const meta = metaOf(nextBooking);
          const pendingDeadline = (nextBooking.status === "درخواست" || nextBooking.status === "تازه")
            ? formatRequestExpiryDeadline(nextBooking.created_at)
            : "";
          return (
            <article
              className="clientBookingFeatureCard is-clickable"
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
              <div className={`clientBookingStatusPill is-${meta.tone}`}>{meta.status}</div>
              {nextBooking.status === AWAITING_CLIENT ? (
                <p className="clientBookingPendingNote">
                  <CalendarClock size={14} />
                  سالن ساعت تازه‌ای پیشنهاد داده؛ برای قبول یا رد، کارت را باز کن
                </p>
              ) : null}
              {pendingDeadline ? (
                <p className="clientBookingPendingNote">
                  <Clock3 size={14} />
                  سالن تا ساعت {pendingDeadline} پاسخ می‌دهد؛ وگرنه رزرو خودکار لغو می‌شود
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
        })() : (
          <div className="clientBookingsEmpty">
            <Mascot pose="calendar" size={168} className="mascotEmpty" />
            <b>{bookings.length ? "نوبت فعالی نداری" : "هنوز رزروی ثبت نشده"}</b>
            <span>
              {bookings.length
                ? "نوبت‌های قبلی‌ات در سابقه هستند. از بخش «سالن» نوبت تازه بگیر."
                : "بعد از رزرو سالن، نوبت‌ها اینجا نمایش داده می‌شوند."}
            </span>
          </div>
        )}

        {otherBookings.length ? (
          <div className="clientBookingOtherList" aria-label="سایر نوبت‌های پیش‌رو">
            <span>سایر نوبت‌های پیش‌رو</span>
            {otherBookings.map((booking, index) => {
              const meta = metaOf(booking);
              return (
                <button
                  type="button"
                  className="clientBookingMiniCard"
                  key={`${booking.bookingSource || "salon"}-${booking.id || index}`}
                  onClick={() => onOpenSettings?.(booking)}
                >
                  <span className={`clientBookingMiniLogo ${meta.avatar ? "hasImage" : ""}`} aria-hidden="true">
                    {meta.avatar ? <img src={meta.avatar} alt="" /> : String(meta.salonName).slice(0, 1)}
                  </span>
                  <div>
                    <b className="svcInline"><ServiceIcon emoji={meta.serviceEmoji} name={meta.service} size="xs" />{meta.service}</b>
                    <small>{meta.salonName} • {meta.date}</small>
                  </div>
                  <div className="clientBookingMiniState">
                    <strong className={`is-${meta.tone}`}>{meta.status}</strong>
                    <em>{meta.time}</em>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <ClientBookingHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        bookings={past}
        onOpenBooking={(booking) => {
          setHistoryOpen(false);
          onOpenSettings?.({ ...booking, clientBookingSheetMode: "details" });
        }}
        onRebook={(booking) => {
          setHistoryOpen(false);
          onRebook?.(booking);
        }}
      />
    </>
  );
}
