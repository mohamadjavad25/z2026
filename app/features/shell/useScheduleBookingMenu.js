"use client";

import { useCallback, useState } from "react";
import { summarizeBookingParts } from "../../shared/lib/bookingParts";

/**
 * The per-booking action menu opened from the salon/artist weekly schedule
 * ("change time", "change staff", "cancel"), plus the client-profile lookup
 * shown alongside it.
 *
 * Depends on pieces owned by useArtistWorkspace (artistBookingList) and
 * useSalonWorkspace (salonAppointmentList, selectedBookingClient,
 * setSelectedBookingClient, patchSalonAppointment) — this hook must be
 * called after both, with their return values passed in.
 *
 * @param {{
 *   artistBookingList?: Array<Record<string, unknown>>,
 *   salonAppointmentList?: Array<Record<string, unknown>>,
 *   setSelectedBookingClient: (client: unknown) => void,
 *   patchSalonAppointment: (booking: unknown, patch: object, notice: string) => Promise<boolean>
 * }} options
 */
export function useScheduleBookingMenu({
  artistBookingList = [],
  salonAppointmentList = [],
  setSelectedBookingClient,
  patchSalonAppointment
} = {}) {
  const [scheduleBookingMenu, setScheduleBookingMenu] = useState(null);
  const [scheduleBookingView, setScheduleBookingView] = useState("menu");

  const buildBookingClientProfile = useCallback((booking) => {
    if (!booking) return null;
    const relatedArtist = artistBookingList.filter((item) => {
      if (booking.clientUserId && item.clientUserId === booking.clientUserId) return true;
      if (booking.client_user_id && item.clientUserId === booking.client_user_id) return true;
      if (booking.phone && item.phone && item.phone === booking.phone) return true;
      return item.client && booking.client && item.client === booking.client;
    });
    const relatedSalon = salonAppointmentList.filter((item) => {
      if (item.status === "لغو") return false;
      if ((booking.client_user_id || booking.clientUserId) && item.client_user_id === (booking.client_user_id || booking.clientUserId)) return true;
      if (booking.phone && item.phone && item.phone === booking.phone) return true;
      return item.client && booking.client && item.client === booking.client;
    });
    const related = relatedArtist.length ? relatedArtist : relatedSalon.map((item) => ({
      ...item,
      date: item.booking_date || item.date || "",
      clientAvatar: item.clientAvatar || item.client_avatar || ""
    }));
    return {
      id: booking.clientUserId || booking.client_user_id || null,
      name: booking.client || "مشتری",
      phone: booking.phone || "",
      avatar: booking.clientAvatar || booking.client_avatar || "",
      area: booking.clientArea || "",
      bio: booking.clientBio || "",
      type: booking.clientType || "client",
      bookingCount: related.length || 1,
      bookings: related,
      lastBooking: booking
    };
  }, [artistBookingList, salonAppointmentList]);

  const openScheduleBookingMenu = useCallback((booking, ownerType) => {
    const next = booking && ownerType && !booking.ownerType
      ? { ...booking, ownerType }
      : booking;
    if (next) {
      setSelectedBookingClient(buildBookingClientProfile(next));
    }
    setScheduleBookingMenu(next);
    setScheduleBookingView("menu");
  }, [buildBookingClientProfile, setSelectedBookingClient]);

  const closeScheduleBookingMenu = useCallback(() => {
    setScheduleBookingMenu(null);
    setScheduleBookingView("menu");
    setSelectedBookingClient(null);
  }, [setSelectedBookingClient]);

  const changeScheduleBookingTime = useCallback(async (time) => {
    if (!scheduleBookingMenu) return;
    // A client's own booking does not just move: the new time goes to them to accept or decline.
    const askedClient = Boolean(scheduleBookingMenu.client_user_id || scheduleBookingMenu.clientUserId);
    const ok = await patchSalonAppointment(
      scheduleBookingMenu,
      { time },
      askedClient ? `ساعت ${time} برای مشتری فرستاده شد؛ تا قبول کند «در انتظار مشتری» می‌ماند.` : `ساعت رزرو به ${time} تغییر کرد.`
    );
    if (ok) closeScheduleBookingMenu();
  }, [scheduleBookingMenu, patchSalonAppointment, closeScheduleBookingMenu]);

  const changeScheduleBookingStaff = useCallback(async (staffName) => {
    if (!scheduleBookingMenu) return;
    const ok = await patchSalonAppointment(scheduleBookingMenu, { staff: staffName }, `آرتیست رزرو به «${staffName}» تغییر کرد.`);
    if (ok) closeScheduleBookingMenu();
  }, [scheduleBookingMenu, patchSalonAppointment, closeScheduleBookingMenu]);

  // A multi-service booking: new order and/or artist per service. The menu stays open so the
  // salon can make several changes in a row.
  const changeScheduleBookingParts = useCallback(async (parts) => {
    if (!scheduleBookingMenu) return false;
    const ok = await patchSalonAppointment(scheduleBookingMenu, { parts }, "تقسیم نوبت به‌روز شد.");
    if (ok) {
      const summary = summarizeBookingParts(parts);
      setScheduleBookingMenu((current) => (current
        ? { ...current, parts: JSON.stringify(parts), service: summary.service, duration_minutes: summary.durationMinutes }
        : current));
    }
    return ok;
  }, [scheduleBookingMenu, patchSalonAppointment]);

  const cancelScheduleBooking = useCallback(async () => {
    if (!scheduleBookingMenu) return;
    const ok = await patchSalonAppointment(scheduleBookingMenu, { status: "لغو", action: "cancel" }, "رزرو لغو شد.");
    if (ok) closeScheduleBookingMenu();
  }, [scheduleBookingMenu, patchSalonAppointment, closeScheduleBookingMenu]);

  return {
    scheduleBookingMenu,
    setScheduleBookingMenu,
    scheduleBookingView,
    setScheduleBookingView,
    openScheduleBookingMenu,
    closeScheduleBookingMenu,
    changeScheduleBookingTime,
    changeScheduleBookingStaff,
    changeScheduleBookingParts,
    cancelScheduleBooking
  };
}
