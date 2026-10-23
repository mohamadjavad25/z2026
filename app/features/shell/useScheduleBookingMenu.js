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

  // `overtime`: the salon chose a time that runs past closing (it stays longer).
  const changeScheduleBookingTime = useCallback(async (time, { overtime = false } = {}) => {
    if (!scheduleBookingMenu) return;
    // A client's own booking does not just move: the new time goes to them to accept or decline.
    const askedClient = Boolean(scheduleBookingMenu.client_user_id || scheduleBookingMenu.clientUserId);
    // A CONFIRMED booking is only ever a proposal: its original time stays until the client accepts (owner's rules of 2026-10-22).
    const confirmed = ["تایید شده", "تازه"].includes(scheduleBookingMenu.status);
    const ok = await patchSalonAppointment(
      scheduleBookingMenu,
      overtime ? { time, overtime: true } : { time },
      askedClient
        ? (confirmed
          ? `پیشنهاد ساعت ${time} برای مشتری فرستاده شد. تا قبول نکند، نوبت همان ساعت قبلی می‌ماند.`
          : `ساعت ${time} برای مشتری فرستاده شد؛ تا قبول کند «در انتظار مشتری» می‌ماند.`)
        : `ساعت رزرو به ${time} تغییر کرد.`
    );
    if (ok) closeScheduleBookingMenu();
  }, [scheduleBookingMenu, patchSalonAppointment, closeScheduleBookingMenu]);

  // The screen stays open (it follows the live list), so the salon can go on to approve it.
  const changeScheduleBookingStaff = useCallback(async (staffName) => {
    if (!scheduleBookingMenu) return false;
    return patchSalonAppointment(
      scheduleBookingMenu,
      { staff: staffName },
      staffName ? `آرتیست رزرو به «${staffName}» تغییر کرد.` : "آرتیست از این رزرو برداشته شد."
    );
  }, [scheduleBookingMenu, patchSalonAppointment]);

  // «تقسیم خودکار»: the server gives each service to a free artist again, from scratch.
  const autoAssignScheduleBooking = useCallback(async () => {
    if (!scheduleBookingMenu) return false;
    return patchSalonAppointment(scheduleBookingMenu, { autoAssign: true }, "آرتیست‌ها خودکار چیده شدند.");
  }, [scheduleBookingMenu, patchSalonAppointment]);

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

  // The salon takes its proposal back; the booking stays at its original time.
  const withdrawScheduleProposal = useCallback(async () => {
    if (!scheduleBookingMenu) return false;
    return patchSalonAppointment(scheduleBookingMenu, { withdrawProposal: true }, "پیشنهاد پس گرفته شد؛ نوبت همان ساعت قبلی است.");
  }, [scheduleBookingMenu, patchSalonAppointment]);

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
    autoAssignScheduleBooking,
    cancelScheduleBooking,
    withdrawScheduleProposal
  };
}
