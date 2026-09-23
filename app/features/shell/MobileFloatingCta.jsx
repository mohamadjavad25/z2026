"use client";

import { Plus } from "lucide-react";
import { BookingCtaSegment } from "../profile/BookingCtaSegment";

/**
 * Owner mobile floating CTA (salon / artist).
 * Presentational: open flags + callbacks owned by HomeApp.
 * Salon uses modeRail (ProfileModeRail) in the purple dock, which is a
 * hard-locked 4-button grid (styled per nth-child at multiple cascade
 * layers) — a 5th "create booking" button doesn't fit inside it without
 * breaking that layout, so it renders as its own small round button
 * floating just above the dock instead. Artist has no modeRail here, so
 * it gets the full BookingCtaSegment bar in that same slot.
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

  if (modeRail) {
    return (
      <>
        <div className="floatingMobileCta is-modeRail" aria-label="بخش‌های پروفایل موبایل">
          {modeRail}
        </div>
        <button
          type="button"
          className={`floatingCreateBookingBtn ${bookingSheetOpen ? "is-active" : ""}`}
          onClick={onToggleBooking}
          aria-label="ثبت رزرو دستی"
          aria-pressed={bookingSheetOpen}
          title="ثبت رزرو دستی"
        >
          <Plus size={20} />
        </button>
      </>
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
