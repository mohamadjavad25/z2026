"use client";

import { ConnectPage } from "../connect/ConnectPage";
import { ClientBookingsPanel } from "./ClientBookingsPanel";
import { isBookingAhead } from "./bookingStatus";

/**
 * Client role — the page under the profile header: «نوبت‌های من», where every booking stands, and the card
 * to start a new one: search by name first (a small scan button beside it), then the categories
 * (user's choice 2026-10-23). With nothing ahead the card comes first; otherwise the bookings do.
 * The places the client is connected to live on the «رزرو» tab (ClientBookTabs).
 */
export function ClientHome({ bookings = [], highlightKey = "", clientName = "", clientAvatar = "", onOpenBooking, onRebook, onOpenPlace, onFindPlaces, onNotify }) {
  const hasAhead = bookings.some((booking) => isBookingAhead(booking));
  const find = (
    <ConnectPage
      compact
      me={{ name: clientName, avatar: clientAvatar }}
      onOpenProfile={onOpenPlace}
      onNotify={onNotify}
    />
  );
  return (
    <div className={`clientHome${hasAhead ? "" : " is-findFirst"}`}>
      {hasAhead ? null : find}
      <ClientBookingsPanel
        bookings={bookings}
        compactEmpty
        highlightKey={highlightKey}
        onOpenSettings={onOpenBooking}
        onRebook={onRebook}
        clientName={clientName}
        onNotify={onNotify}
        onFindPlaces={onFindPlaces}
        onOpenPlace={onOpenPlace}
      />
      {hasAhead ? find : null}
    </div>
  );
}
