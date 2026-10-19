"use client";

import { useCallback, useEffect, useState } from "react";
import { Mascot } from "../../components/Mascot";
import { listConnections } from "../../shared/api/connections";
import { useAppRefresh } from "../../shared/lib/appRefresh";
import { ClientBookingsPanel } from "./ClientBookingsPanel";
import { AddPlaceActions } from "./AddPlaceActions";

/**
 * Client role — the page under the profile header: «نوبت‌های من», where every booking stands, and under it
 * the quick way to bring a salon or artist in (from contacts, or by scanning their QR) — only for the very
 * first moment: no booking and nobody connected yet. Once either exists the card is gone.
 * Starting a booking lives on the «رزرو» tab (ClientBookTabs), not here.
 */
export function ClientHome({ bookings = [], highlightKey = "", clientName = "", onOpenBooking, onRebook, onOpenPlace, onFindPlaces, onNotify }) {
  const [connected, setConnected] = useState(null); // null = still loading
  const load = useCallback(async () => {
    const { ok, data } = await listConnections();
    if (ok) setConnected(Array.isArray(data?.connections) && data.connections.length > 0);
  }, []);
  useEffect(() => { load(); }, [load]);
  useAppRefresh(load);
  const showConnect = connected === false && bookings.length === 0;

  return (
    <div className="clientHome">
      <ClientBookingsPanel
        bookings={bookings}
        compactEmpty
        emptyLine={!showConnect}
        emptyMascot={bookings.length > 0 || connected === true}
        highlightKey={highlightKey}
        onOpenSettings={onOpenBooking}
        onRebook={onRebook}
      />
      {showConnect ? (
      <section className="chCard chStart" aria-label="وصل کردن سالن یا آرتیست">
        <Mascot pose="search" size={64} className="chEmptyMascot" />
        <b>سالن یا آرتیستت را وصل کن</b>
        <span>از مخاطبین یا با اسکن QR.</span>
        <AddPlaceActions
          clientName={clientName}
          onOpenPlace={onOpenPlace}
          onFindPlaces={onFindPlaces}
          onConnected={() => setConnected(true)}
          onNotify={onNotify}
        />
      </section>
      ) : null}
    </div>
  );
}
