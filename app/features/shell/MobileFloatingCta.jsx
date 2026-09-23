"use client";

import { Plus } from "lucide-react";

/**
 * Owner mobile floating CTA (salon only).
 * Presentational: open flags + callbacks owned by HomeApp.
 * Salon uses modeRail (ProfileModeRail) in the purple dock, which is a
 * hard-locked 4-button grid (styled per nth-child at multiple cascade
 * layers) — a "create booking" button doesn't fit inside it without
 * breaking that layout, so it renders as its own small round button
 * floating just above the dock instead.
 * Artist's create-booking entry point lives in BottomNav instead (the
 * profile tab's avatar swaps for a "+" button while already on the
 * profile page) — see BottomNav.jsx's showCreateBooking prop.
 */
export function MobileFloatingCta({
  open = false,
  profileType,
  bookingSheetOpen = false,
  modeRail = null,
  onToggleBooking
}) {
  if (!open || !profileType || !modeRail) return null;

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
