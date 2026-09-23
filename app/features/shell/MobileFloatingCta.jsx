"use client";

import { MessageCircle } from "lucide-react";
import { BookingCtaSegment } from "../profile/BookingCtaSegment";

/**
 * Owner mobile floating CTA (salon / artist / client).
 * Presentational: open flags + callbacks owned by HomeApp.
 * Salon/artist use modeRail (ProfileModeRail) in the purple dock.
 */
export function MobileFloatingCta({
  open = false,
  profileType,
  sheetOpen = false,
  bookingSheetOpen = false,
  modeRail = null,
  onToggleBooking,
  onOpenClientChat
}) {
  if (!open || !profileType) return null;
  if (profileType === "artist") return null;

  if (modeRail) {
    return (
      <div className="floatingMobileCta is-modeRail" aria-label="بخش‌های پروفایل موبایل">
        {modeRail}
      </div>
    );
  }

  return (
    <div
      className={`floatingMobileCta floatingMobileCtaSplit ${sheetOpen ? "is-open" : ""}`}
      aria-label="اقدام سریع موبایل"
    >
      {(profileType === "salon" || profileType === "artist") ? (
        <BookingCtaSegment
          title="ایجاد رزرو"
          hint="نوبت جدید برای مشتری"
          active={bookingSheetOpen}
          onClick={onToggleBooking}
        />
      ) : (
        <button type="button" className="ctaSegment ctaManage" onClick={onOpenClientChat}>
          <span className="ctaIcon"><MessageCircle size={18} /></span>
          <span className="ctaText">
            <b>چت</b>
            <small>پیام‌های تو</small>
          </span>
        </button>
      )}
    </div>
  );
}
