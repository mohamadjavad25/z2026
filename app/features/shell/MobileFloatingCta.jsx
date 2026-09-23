"use client";

import { BookingCtaSegment } from "../profile/BookingCtaSegment";

/**
 * Owner mobile floating CTA (salon / artist).
 * Presentational: open flags + callbacks owned by HomeApp.
 * Salon/artist use modeRail (ProfileModeRail) in the purple dock.
 */
export function MobileFloatingCta({
  open = false,
  profileType,
  sheetOpen = false,
  bookingSheetOpen = false,
  modeRail = null,
  onToggleBooking
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
      <BookingCtaSegment
        title="ایجاد رزرو"
        hint="نوبت جدید برای مشتری"
        active={bookingSheetOpen}
        onClick={onToggleBooking}
      />
    </div>
  );
}
