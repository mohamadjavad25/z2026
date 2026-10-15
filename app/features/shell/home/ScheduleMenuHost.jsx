"use client";

import { useEffect, useMemo, useRef } from "react";
import { ScheduleBookingMenuModal } from "../../schedule";
import { useHome } from "../HomeContext";
import { normalizeSalonScheduleBooking } from "../../profile/ScheduleRow";
import { requestMinutesLeft } from "../../../shared/lib/bookingWindow";

const AUTO_OPENED_KEY = "frfro_auto_opened_requests";

function readAutoOpened() {
  try {
    return new Set(JSON.parse(window.sessionStorage.getItem(AUTO_OPENED_KEY) || "[]").map(String));
  } catch {
    return new Set();
  }
}

function rememberAutoOpened(seen) {
  try {
    window.sessionStorage.setItem(AUTO_OPENED_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    // worst case a request opens once more after a reload
  }
}

/**
 * A client's new request opens straight away as the full booking screen, so the salon answers it
 * while it is fresh instead of finding it later (or after it expired). Each request opens on its
 * own once -- closing it is respected -- and never over another open booking; several waiting
 * requests open one after the other, the one that expires first first.
 */
function useAutoOpenSalonRequests({ enabled, bookings, staffList, serviceList, menuOpen, open }) {
  const seenRef = useRef(null);
  const staffByName = useMemo(
    () => new Map(staffList.map((person) => [String(person.name || "").trim(), person])),
    [staffList]
  );

  useEffect(() => {
    if (!enabled || menuOpen || typeof window === "undefined") return;
    seenRef.current ??= readAutoOpened();
    const seen = seenRef.current;
    const next = bookings
      .filter((booking) => booking.status === "درخواست" && booking.id != null && !seen.has(String(booking.id)))
      .filter((booking) => (requestMinutesLeft(booking.created_at || booking.createdAt, booking.booking_date || booking.date, booking.time) ?? 1) > 0)
      .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))[0];
    if (!next) return;
    seen.add(String(next.id));
    rememberAutoOpened(seen);
    open({ ...next, ...normalizeSalonScheduleBooking(next, staffByName, serviceList) }, "salon");
  }, [enabled, bookings, staffByName, serviceList, menuOpen, open]);
}

export function ScheduleMenuHost() {
  const {
    scheduleBookingMenu,
    createdProfile,
    scheduleBookingView,
    setScheduleBookingView,
    safeSalonStaffList,
    bookingStaffOptions,
    salonAppointmentList,
    salonServiceList,
    openScheduleBookingMenu,
    closeScheduleBookingMenu,
    changeScheduleBookingTime,
    changeScheduleBookingStaff,
    changeScheduleBookingParts,
    autoAssignScheduleBooking,
    cancelScheduleBooking,
    scheduleBookingBusy,
    approveReservationRequest,
    confirmArtistBookingRequest,
    declineReservationRequest,
    declineArtistBookingRequest
  } = useHome();

  const isSalon = createdProfile?.type === "salon";
  const salonBookings = useMemo(() => (Array.isArray(salonAppointmentList) ? salonAppointmentList : []), [salonAppointmentList]);

  useAutoOpenSalonRequests({
    enabled: isSalon,
    bookings: salonBookings,
    staffList: safeSalonStaffList || [],
    serviceList: salonServiceList || [],
    menuOpen: Boolean(scheduleBookingMenu),
    open: openScheduleBookingMenu
  });

  // The open booking follows the live list (polling, the salon's own edits, a client's answer),
  // so the screen never shows a stale status, time or split.
  const liveBooking = useMemo(() => {
    if (!scheduleBookingMenu || scheduleBookingMenu.ownerType !== "salon" || scheduleBookingMenu.id == null) return scheduleBookingMenu;
    const fresh = salonBookings.find((booking) => String(booking.id) === String(scheduleBookingMenu.id));
    return fresh ? { ...scheduleBookingMenu, ...fresh, ownerType: "salon" } : scheduleBookingMenu;
  }, [scheduleBookingMenu, salonBookings]);

  return (
    <ScheduleBookingMenuModal
      open={Boolean(liveBooking && (isSalon || createdProfile?.type === "artist"))}
      booking={liveBooking}
      view={scheduleBookingView}
      onViewChange={setScheduleBookingView}
      staffOptions={safeSalonStaffList.length ? safeSalonStaffList : bookingStaffOptions}
      onClose={closeScheduleBookingMenu}
      onChangeTime={changeScheduleBookingTime}
      onChangeStaff={changeScheduleBookingStaff}
      onChangeParts={changeScheduleBookingParts}
      onAutoAssign={autoAssignScheduleBooking}
      onCancel={cancelScheduleBooking}
      onApprove={async () => {
        if (!liveBooking) return;
        if (liveBooking.ownerType === "salon") {
          await approveReservationRequest(liveBooking.id);
        } else {
          await confirmArtistBookingRequest(liveBooking.id);
        }
        closeScheduleBookingMenu();
      }}
      onDecline={async () => {
        if (!liveBooking) return;
        if (liveBooking.ownerType === "salon") {
          await declineReservationRequest(liveBooking.id);
        } else {
          await declineArtistBookingRequest(liveBooking.id);
        }
        closeScheduleBookingMenu();
      }}
      busy={scheduleBookingBusy}
    />
  );
}
