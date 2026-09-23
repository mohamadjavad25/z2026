"use client";

import { useCallback, useEffect, useState } from "react";
import {
  artistAvailableSlots,
  artistBookingDays,
  getBookingDateKey
} from "../artist";
import {
  buildDayBookingSlots,
  parseServiceDurationMinutes,
  rangesOverlap,
  timeLabelToMinutes
} from "../../shared/lib/time";
import { salonRegistrationServices } from "../../shared/constants/roles";

/**
 * The "create a booking" sheet: open/close, the staff/service/day/time
 * fields (and their derived option lists / free-slot calculation), for both
 * the salon and the artist booking flow.
 *
 * This is the most cross-cutting of the shell hooks — the free-slot math
 * needs live salon data (staff, services, hours, existing appointments) and
 * the sheet's open handler needs to close every other overlay panel, so it
 * depends on pieces owned by useArtistWorkspace and useSalonWorkspace alike.
 * It must be called after both, with their return values passed in.
 *
 * @param {{
 *   createdProfile?: { type?: string } | null,
 *   safeSalonStaffList?: Array<Record<string, unknown>>,
 *   salonServiceList?: Array<Record<string, unknown>>,
 *   artistServiceList?: Array<Record<string, unknown>>,
 *   salonAppointmentList?: Array<Record<string, unknown>>,
 *   salonScheduleWeekTabs?: Array<{ day: string, dateKey: string }>,
 *   activeSalonHours?: Array<Record<string, unknown>>,
 *   salonWorkspace?: unknown,
 *   salonToolSheetOpen?: boolean,
 *   salonTool?: unknown,
 *   setActiveTab: (tab: string) => void,
 *   setArtistBookingRailOpen: (open: boolean) => void,
 *   setArtistBookingCreateOpen: (open: boolean) => void,
 *   setSalonHeroSheet: (sheet: unknown) => void,
 *   setSalonToolSheetOpen: (open: boolean) => void,
 *   setSalonWorkspace: (workspace: unknown) => void
 * }} options
 */
export function useBookingCreateSheet({
  createdProfile = null,
  safeSalonStaffList = [],
  salonServiceList = [],
  artistServiceList = [],
  salonAppointmentList = [],
  salonScheduleWeekTabs = [],
  activeSalonHours = [],
  salonWorkspace = null,
  salonToolSheetOpen = false,
  salonTool = null,
  setActiveTab,
  setArtistBookingRailOpen,
  setArtistBookingCreateOpen,
  setSalonHeroSheet,
  setSalonToolSheetOpen,
  setSalonWorkspace
} = {}) {
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [bookingStaffName, setBookingStaffName] = useState("");
  const [bookingServiceName, setBookingServiceName] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("۱۸:۳۰");
  const [bookingSelectMenu, setBookingSelectMenu] = useState("");

  const isBookingSlotTaken = useCallback((staff, time, forDate = "امروز", durationMinutes = 60) => {
    const targetDateKey = getBookingDateKey(forDate);
    const start = timeLabelToMinutes(time);
    const end = start + Math.max(15, Number(durationMinutes) || 60);
    return salonAppointmentList.some((item) => {
      if (item.status === "لغو") return false;
      if (getBookingDateKey(item.booking_date || item.date || "امروز") !== targetDateKey) return false;
      const nextStaff = String(staff || "").trim();
      const bookedStaff = String(item.staff || "").trim();
      if (nextStaff && nextStaff !== bookedStaff) return false;
      const bookedStart = timeLabelToMinutes(item.time);
      const bookedEnd = bookedStart + Math.max(15, Number(item.duration_minutes || item.durationMinutes) || 60);
      return rangesOverlap(start, end, bookedStart, bookedEnd);
    });
  }, [salonAppointmentList]);

  const bookingStaffForSlots = bookingStaffName || safeSalonStaffList[0]?.name || "";
  const bookingServiceOptions = salonServiceList.length
    ? salonServiceList
    : salonRegistrationServices.map((name) => ({ name, price: "", duration: "" }));
  const bookingStaffOptions = safeSalonStaffList.length
    ? safeSalonStaffList
    : [{ name: "مدیر سالن", role: "هماهنگی رزرو" }, { name: "متخصص زیبایی", role: "خدمات اصلی" }];
  const selectedBookingStaff = bookingStaffForSlots || bookingStaffOptions[0]?.name || "";

  const bookingDateForSlots = bookingDate
    || salonScheduleWeekTabs.find((tab) => {
      const hour = activeSalonHours.find((item) => item.day === tab.day);
      return hour?.active;
    })?.dateKey
    || salonScheduleWeekTabs[0]?.dateKey
    || "امروز";
  const selectedBookingDateTab = salonScheduleWeekTabs.find((tab) => (
    getBookingDateKey(tab.dateKey) === getBookingDateKey(bookingDateForSlots)
  )) || salonScheduleWeekTabs[0];
  const selectedBookingDayHour = activeSalonHours.find((hour) => hour.day === selectedBookingDateTab?.day)
    || activeSalonHours[0];
  const selectedBookingService = bookingServiceOptions.find((item) => item.name === bookingServiceName)
    || bookingServiceOptions[0];
  const bookingDaySlots = buildDayBookingSlots(
    selectedBookingDayHour?.open_time,
    selectedBookingDayHour?.close_time,
    parseServiceDurationMinutes(selectedBookingService?.duration)
  );
  const bookingFreeSlots = bookingDaySlots.filter(
    (slot) => !isBookingSlotTaken(
      selectedBookingStaff,
      slot,
      bookingDateForSlots,
      parseServiceDurationMinutes(selectedBookingService?.duration)
    )
  );

  const openBookingSheet = useCallback(() => {
    setActiveTab("profile");
    setArtistBookingRailOpen(false);
    setArtistBookingCreateOpen(false);
    setSalonHeroSheet(null);
    setSalonToolSheetOpen(false);
    setBookingSelectMenu("");
    if (createdProfile?.type === "salon") {
      setSalonWorkspace(null);
    } else {
      const nextDay = artistBookingDays.includes(bookingDate) ? bookingDate : (artistBookingDays[1] || artistBookingDays[0] || "فردا");
      setBookingDate(nextDay);
      setBookingTime(artistAvailableSlots[0] || "");
      if (artistServiceList[0]?.name) {
        setBookingServiceName(artistServiceList[0].name);
      }
    }
    setBookingSheetOpen(true);
  }, [
    createdProfile?.type,
    bookingDate,
    artistServiceList,
    setActiveTab,
    setArtistBookingRailOpen,
    setArtistBookingCreateOpen,
    setSalonHeroSheet,
    setSalonToolSheetOpen,
    setSalonWorkspace
  ]);

  const closeBookingSheet = useCallback(() => {
    setBookingSheetOpen(false);
    setBookingSelectMenu("");
  }, []);

  useEffect(() => {
    const activeTool = salonWorkspace || (salonToolSheetOpen ? salonTool : null);
    if (activeTool === "booking" && createdProfile?.type === "salon") {
      setBookingSelectMenu("");
    }
  }, [salonWorkspace, salonToolSheetOpen, salonTool, createdProfile?.type]);

  useEffect(() => {
    const slots = createdProfile?.type === "artist" && bookingSheetOpen
      ? artistAvailableSlots
      : bookingFreeSlots;
    if (!slots.length) return;
    if (!slots.includes(bookingTime)) {
      setBookingTime(slots[0]);
    }
  }, [createdProfile?.type, bookingSheetOpen, bookingFreeSlots.join("|"), bookingTime]);

  return {
    bookingSheetOpen,
    setBookingSheetOpen,
    bookingStaffName,
    setBookingStaffName,
    bookingServiceName,
    setBookingServiceName,
    bookingDate,
    setBookingDate,
    bookingTime,
    setBookingTime,
    bookingSelectMenu,
    setBookingSelectMenu,
    bookingServiceOptions,
    bookingStaffOptions,
    selectedBookingStaff,
    bookingDateForSlots,
    selectedBookingService,
    bookingDaySlots,
    bookingFreeSlots,
    openBookingSheet,
    closeBookingSheet
  };
}
