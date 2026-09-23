"use client";

import { Plus } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { getArtistBookingStatusKey } from "../artist";

const ARTIST_BAR_TIME_STATUS_COLOR = {
  ok: "#c9c2ff",
  wait: "#ffd76a",
  vip: "#f0b4e0",
  cancelled: "#ff9a9a",
  expired: "#e0a99f"
};

/**
 * Owner mobile floating CTA (salon / artist).
 * Presentational: open flags + callbacks owned by HomeApp.
 * Salon uses modeRail (ProfileModeRail) in the purple dock, which is a
 * hard-locked 4-button grid (styled per nth-child at multiple cascade
 * layers) — a "create booking" button doesn't fit inside it without
 * breaking that layout, so it renders as its own small round button
 * floating just above the dock instead.
 * Artist has no modeRail here, so it gets a single navy/plum bar with
 * the create-booking button and today's booked times side by side —
 * replaces what used to be two separate floating widgets (this CTA bar
 * and the draggable ArtistBookingRail).
 */
export function MobileFloatingCta({
  open = false,
  profileType,
  bookingSheetOpen = false,
  modeRail = null,
  todayBookings = [],
  onToggleBooking,
  onOpenBookings
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

  if (profileType !== "artist") return null;

  return (
    <div className="floatingMobileCta floatingArtistBar" aria-label="نوار رزرو آرتیست">
      <button
        type="button"
        className={`floatingArtistBarCreate ${bookingSheetOpen ? "is-active" : ""}`}
        onClick={onToggleBooking}
        aria-label="ایجاد رزرو جدید"
        aria-pressed={bookingSheetOpen}
      >
        <Plus size={18} />
        <span>رزرو جدید</span>
      </button>
      <button
        type="button"
        className="floatingArtistBarTimes"
        onClick={onOpenBookings}
        aria-label={todayBookings.length ? `مشاهده ${todayBookings.length} نوبت امروز` : "نوبتی برای امروز ثبت نشده"}
      >
        {todayBookings.length ? (
          todayBookings.map((booking) => (
            <SegmentClock
              key={booking.id}
              value={booking.time}
              size="xs"
              as="span"
              backgroundColor="transparent"
              color={ARTIST_BAR_TIME_STATUS_COLOR[getArtistBookingStatusKey(booking.status)]}
            />
          ))
        ) : (
          <small className="floatingArtistBarEmpty">نوبتی امروز نیست</small>
        )}
      </button>
    </div>
  );
}
