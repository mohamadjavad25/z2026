"use client";

import { useCallback, useEffect, useState } from "react";
import { isSlotInPast } from "../../shared/lib/slots";
import {
  buildExactBookingDateTabs,
  getBookingDateKey,
  isPublicArtistSlotBlocked
} from "../artist";
import {
  buildDayBookingSlots,
  buildPublicBookingSlots,
  parseServiceDurationMinutes,
  rangesOverlap,
  timeLabelToMinutes
} from "../../shared/lib/time";

// 7 real calendar days starting today -- matches the rolling range the
// client-facing direct-artist booking flow already offers
// (PublicArtistBookingPanel/salonClientBookingDays), so an artist logging a
// walk-in/phone booking themselves isn't limited to "today/tomorrow/day
// after" the way this sheet used to be.
const ARTIST_BOOKING_DAY_TABS = buildExactBookingDateTabs(7);

// A time that starts in the next few minutes can't really be served (the
// customer isn't there yet, the artist is mid-job), so today's list starts a
// little after "now" instead of at the current minute.
const BOOKING_LEAD_MINUTES = 15;

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
  artistBookingList = [],
  artistBreakTime = null,
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

  // Re-evaluate "what is still in the future" while the sheet stays open.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (!bookingSheetOpen) return undefined;
    const id = setInterval(() => setClockTick((value) => value + 1), 60_000);
    return () => clearInterval(id);
  }, [bookingSheetOpen]);
  const soon = new Date(Date.now() + BOOKING_LEAD_MINUTES * 60_000);

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

  const bookingServiceOptions = salonServiceList;
  const bookingStaffOptions = safeSalonStaffList;

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
  const selectedBookingDuration = parseServiceDurationMinutes(selectedBookingService?.duration);
  const bookingDaySlots = buildDayBookingSlots(
    selectedBookingDayHour?.open_time,
    selectedBookingDayHour?.close_time,
    selectedBookingDuration
  );

  // Who can take a slot: the staff member picked explicitly, or -- when none is
  // picked ("any free artist") -- everyone on the team. A slot is offered as
  // long as at least one of them is free, and that free person is the one the
  // booking is assigned to.
  const staffNames = safeSalonStaffList.map((person) => person.name).filter(Boolean);
  const staffPool = bookingStaffName ? [bookingStaffName] : (staffNames.length ? staffNames : [""]);
  const freeStaffAt = (dateKey, slot) => staffPool.filter(
    (name) => !isBookingSlotTaken(name, slot, dateKey, selectedBookingDuration)
  );
  const salonFreeSlotsFor = (dateKey) => {
    const tab = salonScheduleWeekTabs.find((item) => getBookingDateKey(item.dateKey) === getBookingDateKey(dateKey));
    const hour = activeSalonHours.find((item) => item.day === tab?.day) || activeSalonHours[0];
    if (hour && !hour.active) return [];
    const slots = buildDayBookingSlots(hour?.open_time, hour?.close_time, selectedBookingDuration);
    return slots.filter((slot) => !isSlotInPast(dateKey, slot, soon) && freeStaffAt(dateKey, slot).length > 0);
  };
  const bookingFreeSlots = salonFreeSlotsFor(bookingDateForSlots);
  const bookingStaffForTime = (slot) => freeStaffAt(bookingDateForSlots, slot)[0] || "";
  const selectedBookingStaff = bookingStaffForTime(bookingTime) || bookingStaffName || bookingStaffOptions[0]?.name || "";

  // Artist side of this same sheet: a real rolling week (not the old fixed
  // "امروز/فردا/پس‌فردا") and slots actually filtered against the artist's
  // own bookings + break time -- previously every hourly slot 09:00-21:00
  // showed as pickable regardless of what was already booked, and a
  // conflict only surfaced after submitting.
  const artistBookingDayOptions = ARTIST_BOOKING_DAY_TABS.map((tab) => ({
    value: tab.dateKey,
    label: `${tab.label} ${tab.sub || ""}`.trim()
  }));
  const artistBookingDateForSlots = artistBookingDayOptions.some((tab) => tab.value === bookingDate)
    ? bookingDate
    : (artistBookingDayOptions[0]?.value || "امروز");
  const selectedArtistService = artistServiceList.find((item) => item.name === bookingServiceName)
    || artistServiceList[0];
  const artistServiceDuration = parseServiceDurationMinutes(selectedArtistService?.duration);
  const artistBookingDaySlots = buildPublicBookingSlots(artistServiceDuration);
  const artistBookedSlots = artistBookingList
    .filter((item) => item.status !== "لغو")
    .map((item) => ({
      booking_date: item.date,
      time: item.time,
      duration_minutes: item.durationMinutes
    }));
  const artistFreeSlotsFor = (dateKey) => artistBookingDaySlots.filter((slot) => (
    !isSlotInPast(dateKey, slot, soon)
    && !isPublicArtistSlotBlocked(
      { breakTime: artistBreakTime, bookedSlots: artistBookedSlots },
      dateKey,
      slot,
      artistServiceDuration
    )
  ));
  const artistBookingFreeSlots = artistFreeSlotsFor(artistBookingDateForSlots);

  // How many free times each offered day still has, so the form can grey out
  // full days and jump to the nearest day that has room.
  const bookingDayFreeCounts = {};
  if (createdProfile?.type === "artist") {
    artistBookingDayOptions.forEach((tab) => { bookingDayFreeCounts[tab.value] = artistFreeSlotsFor(tab.value).length; });
  } else {
    salonScheduleWeekTabs.forEach((tab) => { bookingDayFreeCounts[tab.dateKey] = salonFreeSlotsFor(tab.dateKey).length; });
  }

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
      const nextDay = artistBookingDayOptions.some((tab) => tab.value === bookingDate)
        ? bookingDate
        : (artistBookingDayOptions[0]?.value || "امروز");
      setBookingDate(nextDay);
      if (artistServiceList[0]?.name) {
        setBookingServiceName(artistServiceList[0].name);
      }
    }
    setBookingSheetOpen(true);
  }, [
    createdProfile?.type,
    bookingDate,
    artistServiceList,
    artistBookingDayOptions,
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
      ? artistBookingFreeSlots
      : bookingFreeSlots;
    if (!slots.length) return;
    if (!slots.includes(bookingTime)) {
      setBookingTime(slots[0]);
    }
  }, [
    createdProfile?.type,
    bookingSheetOpen,
    bookingFreeSlots.join("|"),
    artistBookingFreeSlots.join("|"),
    bookingTime
  ]);

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
    bookingStaffForTime,
    bookingDayFreeCounts,
    artistBookingDayOptions,
    artistBookingDateForSlots,
    artistBookingFreeSlots,
    selectedArtistService,
    openBookingSheet,
    closeBookingSheet
  };
}
