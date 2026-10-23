"use client";

import { CalendarOff } from "lucide-react";

/**
 * On a salon's or artist's public page when they take no online bookings right now (their subscription has closed,
 * see app/lib/billing/access.js). Said up front, so nobody fills the booking form only to be refused at the end.
 */
export function BookingPausedNote({ hasPhone = false }) {
  return (
    <p className="pphPausedNote" role="note">
      <CalendarOff size={17} aria-hidden="true" />
      <span>
        <b>فعلاً نوبت آنلاین نمی‌گیره.</b>
        {hasPhone ? " برای نوبت، با دکمهٔ «تماس» هماهنگ کن." : " برای نوبت، مستقیم با خودش هماهنگ کن."}
      </span>
    </p>
  );
}
