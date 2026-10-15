"use client";

import { ClientBookingsPanel } from "./ClientBookingsPanel";

/**
 * Client role — the page under the profile header: «نوبت‌های من», where every booking stands.
 * Starting a booking lives on the «رزرو» tab (ClientBookTabs), not here.
 */
export function ClientHome({ bookings = [], highlightKey = "", onOpenBooking, onRebook }) {
  return (
    <div className="clientHome">
      <ClientBookingsPanel
        bookings={bookings}
        compactEmpty
        highlightKey={highlightKey}
        onOpenSettings={onOpenBooking}
        onRebook={onRebook}
      />
    </div>
  );
}
