"use client";

import { useCallback, useState } from "react";

/**
 * Whether the «ایجاد رزرو» sheet (VisitBooker, see features/booking) is open, and the name and
 * number to start it with (a contact picked on the customers page). Opening it closes every other
 * overlay panel, so it depends on pieces owned by the artist and salon workspaces; call it after
 * both, with their setters passed in.
 *
 * The sheet itself keeps its own picks and asks for what it needs (the services, the free times),
 * so nothing about a booking in progress lives here.
 */
export function useBookingCreateSheet({
  createdProfile = null,
  setActiveTab,
  setArtistBookingRailOpen,
  setArtistBookingCreateOpen,
  setSalonHeroSheet,
  setSalonToolSheetOpen,
  setSalonWorkspace
} = {}) {
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [bookingPrefill, setBookingPrefill] = useState(null);

  // `prefill` ({ client, phone }) comes from «مخاطبین» on the customers page; the owner stays on
  // that page instead of being sent to the profile tab.
  const openBookingSheet = useCallback((prefill = null) => {
    const customer = prefill && typeof prefill === "object" && !("nativeEvent" in prefill) ? prefill : null;
    setBookingPrefill(customer ? { client: String(customer.client || ""), phone: String(customer.phone || "") } : null);
    if (!customer) setActiveTab("profile");
    setArtistBookingRailOpen(false);
    setArtistBookingCreateOpen(false);
    setSalonHeroSheet(null);
    setSalonToolSheetOpen(false);
    if (createdProfile?.type === "salon") setSalonWorkspace(null);
    setBookingSheetOpen(true);
  }, [
    createdProfile?.type,
    setActiveTab,
    setArtistBookingRailOpen,
    setArtistBookingCreateOpen,
    setSalonHeroSheet,
    setSalonToolSheetOpen,
    setSalonWorkspace
  ]);

  const closeBookingSheet = useCallback(() => {
    setBookingSheetOpen(false);
  }, []);

  return {
    bookingSheetOpen,
    setBookingSheetOpen,
    bookingPrefill,
    openBookingSheet,
    closeBookingSheet
  };
}
