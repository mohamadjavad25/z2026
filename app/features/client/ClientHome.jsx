"use client";

import { Mascot } from "../../components/Mascot";
import { ClientBookingsPanel } from "./ClientBookingsPanel";
import { AddPlaceActions } from "./AddPlaceActions";

/**
 * Client role — the page under the profile header: «نوبت‌های من», where every booking stands, and under it
 * the quick way to bring a salon or artist in (from contacts, or by scanning their QR).
 * Starting a booking lives on the «رزرو» tab (ClientBookTabs), not here.
 */
export function ClientHome({ bookings = [], highlightKey = "", clientName = "", onOpenBooking, onRebook, onOpenPlace, onFindPlaces, onNotify }) {
  return (
    <div className="clientHome">
      <ClientBookingsPanel
        bookings={bookings}
        compactEmpty
        highlightKey={highlightKey}
        onOpenSettings={onOpenBooking}
        onRebook={onRebook}
      />
      <section className="chCard chEmpty" aria-label="وصل کردن سالن یا آرتیست">
        <Mascot pose="search" size={84} className="chEmptyMascot" />
        <b>سالن یا آرتیستت را وصل کن</b>
        <span>از مخاطبین انتخابش کن یا کد QR او را اسکن کن.</span>
        <AddPlaceActions
          clientName={clientName}
          onOpenPlace={onOpenPlace}
          onFindPlaces={onFindPlaces}
          onNotify={onNotify}
        />
      </section>
    </div>
  );
}
