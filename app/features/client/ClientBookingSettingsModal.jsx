"use client";

import { CalendarCheck, CheckCircle2, Clock3, MapPin, Phone, RotateCcw, TimerOff, X, XCircle } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { SegmentClock } from "../../components/SegmentClock";
import { toLatinDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";

// Same status-tone mapping as ClientBookingsPanel.jsx's getBookingStatusTone —
// duplicated (not shared) since it's a tiny presentational lookup local to
// each booking-status display, matching this codebase's convention for
// small component-local helpers.
function getBookingStatusTone(status = "") {
  if (status === "تایید شده") return "done";
  if (status === "لغو") return "bad";
  if (status === "منقضی شده") return "expired";
  return "pending";
}

const BOOKING_STATUS_ICONS = {
  pending: Clock3,
  done: CheckCircle2,
  bad: XCircle,
  expired: TimerOff
};

// "رزرو دوباره" only makes sense once this specific booking is settled —
// cancelled/expired outright, or confirmed and its date has already passed
// (the service actually happened). While it's still pending or confirmed
// for a future date, the client already has an active booking; offering
// "book again" there reads as if nothing was booked at all.
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
 * Client role — booking details / quick actions sheet.
 * Presentational: selected booking + call/close callbacks.
 */
export function ClientBookingSettingsModal({
  booking,
  onClose,
  onCallSalon,
  onRebookSalon
}) {
  if (!booking) return null;

  const avatar = booking.salonAvatar || booking.salon_avatar || "";
  const salonName = booking.salonName || booking.salon_name || "سالن منتخب";
  const phone = booking.salonPhone || booking.salon_phone || booking.phone || "";
  const rawDate = booking.booking_date || booking.date || "";
  const formattedDate = rawDate ? formatRelativeBookingDayLabel(rawDate) : "امروز";
  const statusTone = getBookingStatusTone(booking.status || "تازه");
  const StatusIcon = BOOKING_STATUS_ICONS[statusTone];

  return (
    <div
      className="clientBookingSettingsBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="تنظیمات رزرو"
      onClick={onClose}
    >
      <div className="clientBookingSettingsWrap" onClick={(event) => event.stopPropagation()}>
        <div className="clientBookingSettings">
          <div className="clientBookingSettingsHead">
            <span className={`clientBookingSettingsAvatar ${avatar ? "hasImage" : ""}`} aria-hidden="true">
              {avatar ? <img src={avatar} alt="" /> : String(salonName || "س").slice(0, 1)}
            </span>
            <div>
              <small>جزئیات رزرو</small>
              <b className="svcInline"><ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />{booking.service || "خدمت زیبایی"}</b>
              <em>{salonName}</em>
            </div>
            <strong className={`clientBookingSettingsStatus is-${statusTone}`}>
              <StatusIcon size={13} />
              {booking.status || "تازه"}
            </strong>
          </div>
          <div className="clientBookingSettingsTime">
            <SegmentClock value={booking.time || "زمان"} size="sm" as="span" backgroundColor="transparent" />
          </div>
          <div className="clientBookingSettingsGrid">
            <span>
              <CalendarCheck size={14} /> <b>تاریخ</b>
              <em>{formattedDate}</em>
            </span>
            <span>
              <MapPin size={14} /> <b>محدوده</b>
              <em>{booking.salonArea || booking.salon_area || "ثبت نشده"}</em>
            </span>
          </div>
          <div className="clientBookingSettingsActions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (typeof onCallSalon === "function") {
                  onCallSalon(booking);
                  return;
                }
                if (phone) window.location.href = `tel:${toLatinDigits(phone)}`;
              }}
            >
              <Phone size={16} />
              تماس
            </button>
            {isBookingSettled(booking) ? (
              <button type="button" onClick={() => onRebookSalon?.(booking)}>
                <RotateCcw size={16} />
                رزرو دوباره
              </button>
            ) : null}
          </div>
        </div>
        <button type="button" className="clientBookingSettingsClose" onClick={onClose} aria-label="بستن تنظیمات رزرو">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
