"use client";

import { AlertTriangle, CalendarCheck, MapPin, MessageCircle, Phone, RotateCcw, X } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toLatinDigits } from "../../shared/lib/digits";

/**
 * Client role — booking details / quick actions sheet.
 * Presentational: selected booking + message/call/close callbacks.
 */
export function ClientBookingSettingsModal({
  booking,
  onClose,
  onMessageSalon,
  onCallSalon
}) {
  if (!booking) return null;

  const avatar = booking.salonAvatar || booking.salon_avatar || "";
  const salonName = booking.salonName || booking.salon_name || "سالن منتخب";
  const phone = booking.salonPhone || booking.salon_phone || booking.phone || "";
  const isChangeMode = booking.clientBookingSheetMode === "change";

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
              <small>{isChangeMode ? "تغییر یا لغو نوبت" : "جزئیات رزرو"}</small>
              <b>{booking.service || "خدمت زیبایی"}</b>
              <em>{salonName}</em>
            </div>
            <strong>{booking.status || "درخواست"}</strong>
          </div>
          <div className="clientBookingSettingsTime">
            <SegmentClock value={booking.time || "زمان"} size="sm" as="span" backgroundColor="transparent" />
          </div>
          <div className="clientBookingSettingsGrid">
            <span>
              <CalendarCheck size={14} /> <b>تاریخ</b>
              <em>{booking.booking_date || booking.date || "امروز"}</em>
            </span>
            <span>
              <MapPin size={14} /> <b>محدوده</b>
              <em>{booking.salonArea || booking.salon_area || "ثبت نشده"}</em>
            </span>
          </div>
          {isChangeMode ? (
            <>
              <div className="clientBookingChangePanel">
                <span>
                  <RotateCcw size={17} />
                  <b>درخواست تغییر زمان</b>
                  <em>زمان جدید را با سالن هماهنگ کن؛ وضعیت نوبت تا تایید سالن همین‌جا نمایش داده می‌شود.</em>
                </span>
                <span className="is-warning">
                  <AlertTriangle size={17} />
                  <b>لغو نوبت</b>
                  <em>لغو نوبت ممکن است طبق قوانین سالن نیاز به تایید یا بررسی داشته باشد.</em>
                </span>
              </div>
              <div className="clientBookingSettingsActions is-changeMode">
                <button type="button" className="primary" onClick={() => onMessageSalon?.(booking)}>
                  <MessageCircle size={16} />
                  پیام برای تغییر زمان
                </button>
                <button type="button" className="danger" onClick={() => onMessageSalon?.(booking)}>
                  <X size={16} />
                  درخواست لغو نوبت
                </button>
              </div>
            </>
          ) : (
            <div className="clientBookingSettingsActions">
              <button
                type="button"
                className="primary"
                onClick={() => onMessageSalon?.(booking)}
              >
                <MessageCircle size={16} />
                پیام به سالن
              </button>
              <button
                type="button"
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
            </div>
          )}
        </div>
        <button type="button" className="clientBookingSettingsClose" onClick={onClose} aria-label="بستن تنظیمات رزرو">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
