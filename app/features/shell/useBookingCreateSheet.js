"use client";

import { useCallback, useEffect, useState } from "react";
import { isSlotInPast } from "../../shared/lib/slots";
import { getSalonStaffCalendars } from "../../shared/api/salons";
import {
  bookingHoldsSlot,
  bookingIsOnDateKey,
  findSalonHourForDateKey,
  isSalonHourOpen,
  salonDayWindow
} from "../../shared/lib/salonAvailability";
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

// Short tag under a day chip and the sentence shown when the sheet skips that day.
function describeFullDay(info, tab) {
  if (!info?.reason) return {};
  const dayName = tab?.label === "امروز" ? "امروز" : (tab?.label || "این روز");
  if (info.reason === "closed") {
    return { tag: "تعطیل", note: `${dayName} طبق ساعت کاری سالن تعطیل است.` };
  }
  if (info.reason === "over") {
    return {
      tag: "پایان کار",
      note: info.close
        ? `ساعت کاری ${dayName} تا ${info.close} است و دیگر وقتی برای این خدمت نمانده.`
        : `وقت کاری ${dayName} تمام شده است.`
    };
  }
  if (info.reason === "short") {
    return { tag: "وقت کم", note: `ساعت کاری ${dayName} برای مدت این خدمت کافی نیست.` };
  }
  return { tag: "تکمیل", note: `همهٔ ساعت‌های ${dayName} رزرو شده است.` };
}

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
 *   salonHoursList?: Array<Record<string, unknown>>,
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
  salonHoursList = [],
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
  // Linked artists' own calendars (break + bookings made anywhere), keyed by staff name. The server
  // refuses a time that clashes with them, so the sheet must not offer it either.
  const [staffCalendars, setStaffCalendars] = useState({});
  const isSalonOwner = createdProfile?.type === "salon";
  useEffect(() => {
    if (!bookingSheetOpen || !isSalonOwner) return undefined;
    let cancelled = false;
    const load = () => getSalonStaffCalendars()
      .then(({ ok, data }) => {
        if (cancelled || !ok) return;
        const next = {};
        (data?.calendars || []).forEach((item) => { if (item?.staff) next[String(item.staff).trim()] = item; });
        setStaffCalendars(next);
      })
      .catch(() => {});
    load();
    // Keep it fresh while the sheet stays open (the artist may take a booking elsewhere meanwhile).
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [bookingSheetOpen, isSalonOwner, salonAppointmentList]);

  // Re-evaluate "what is still in the future" while the sheet stays open.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (!bookingSheetOpen) return undefined;
    const id = setInterval(() => setClockTick((value) => value + 1), 60_000);
    return () => clearInterval(id);
  }, [bookingSheetOpen]);
  const soon = new Date(Date.now() + BOOKING_LEAD_MINUTES * 60_000);

  // Same rule as the server (findOverlapConflict): only bookings on that exact date that still hold
  // their slot, and an assigned artist only collides with their own bookings.
  const isBookingSlotTaken = useCallback((staff, time, dateKey, durationMinutes = 60) => {
    const start = timeLabelToMinutes(time);
    const end = start + Math.max(15, Number(durationMinutes) || 60);
    return salonAppointmentList.some((item) => {
      if (!bookingHoldsSlot(item)) return false;
      if (!bookingIsOnDateKey(item, dateKey)) return false;
      const nextStaff = String(staff || "").trim();
      const bookedStaff = String(item.staff || "").trim();
      if (nextStaff && nextStaff !== bookedStaff) return false;
      const bookedStart = timeLabelToMinutes(item.time);
      const bookedEnd = bookedStart + Math.max(15, Number(item.duration_minutes || item.durationMinutes) || 60);
      return rangesOverlap(start, end, bookedStart, bookedEnd);
    });
  }, [salonAppointmentList]);

  const bookingServiceOptions = salonServiceList;
  const selectedBookingService = bookingServiceOptions.find((item) => item.name === bookingServiceName)
    || bookingServiceOptions[0];
  // Members marked inactive or on leave (the manager included) don't take new bookings, and only the
  // artists who do the chosen service are offered (skill match + the salon's own picks). A service
  // nobody is linked to yet stays bookable with the whole active team.
  const activeStaff = safeSalonStaffList.filter((person) => !["غیرفعال", "مرخصی"].includes(String(person.state || "").trim()));
  const serviceStaffIds = (Array.isArray(selectedBookingService?.staff_ids) ? selectedBookingService.staff_ids : []).map(String);
  const serviceStaff = activeStaff.filter((person) => serviceStaffIds.includes(String(person.id)));
  const bookingStaffOptions = serviceStaff.length ? serviceStaff : activeStaff;
  // A pick made for another service doesn't carry over to one that artist doesn't do.
  const pickedStaffName = bookingStaffOptions.some((person) => person.name === bookingStaffName) ? bookingStaffName : "";
  const selectedBookingDuration = parseServiceDurationMinutes(selectedBookingService?.duration);

  // Who can take a slot: the staff member picked explicitly, or -- when none is
  // picked ("any free artist") -- everyone on the team. A slot is offered as
  // long as at least one of them is free, and that free person is the one the
  // booking is assigned to.
  const staffNames = bookingStaffOptions.map((person) => person.name).filter(Boolean);
  const staffPool = pickedStaffName ? [pickedStaffName] : (staffNames.length ? staffNames : [""]);
  const freeStaffAt = (dateKey, slot) => staffPool.filter((name) => {
    if (isBookingSlotTaken(name, slot, dateKey, selectedBookingDuration)) return false;
    const calendar = name ? staffCalendars[String(name).trim()] : null;
    return !(calendar && isPublicArtistSlotBlocked(calendar, dateKey, slot, selectedBookingDuration));
  });

  // Everything the sheet needs to know about one day: is it open, its hours, and which times are still
  // bookable. `reason` says why a day has nothing free, so the owner sees "closed" / "workday over" /
  // "fully booked" instead of a vague "no free time".
  const salonDayInfo = (dateKey) => {
    const hour = findSalonHourForDateKey(salonHoursList, dateKey);
    const { open, close } = salonDayWindow(hour);
    if (!isSalonHourOpen(hour)) return { open, close, closed: true, slots: [], free: [], reason: "closed" };
    const slots = buildDayBookingSlots(open, close, selectedBookingDuration);
    const upcoming = slots.filter((slot) => !isSlotInPast(dateKey, slot, soon));
    const free = upcoming.filter((slot) => freeStaffAt(dateKey, slot).length > 0);
    const reason = free.length ? "" : (!slots.length ? "short" : !upcoming.length ? "over" : "full");
    return { open, close, closed: false, slots, free, reason };
  };
  const salonFreeSlotsFor = (dateKey) => salonDayInfo(dateKey).free;

  // Bookings are only ever made for today or later; the schedule tabs also hold a few past days.
  const upcomingSalonTabs = salonScheduleWeekTabs.filter((tab) => (tab.offset ?? 0) >= 0);
  const salonDayInfoByKey = {};
  upcomingSalonTabs.forEach((tab) => { salonDayInfoByKey[tab.dateKey] = salonDayInfo(tab.dateKey); });
  const pickedUpcoming = upcomingSalonTabs.some((tab) => tab.dateKey === bookingDate);
  const bookingDateForSlots = pickedUpcoming
    ? bookingDate
    : (upcomingSalonTabs.find((tab) => salonDayInfoByKey[tab.dateKey]?.free.length)?.dateKey
      || upcomingSalonTabs[0]?.dateKey
      || bookingDate
      || "امروز");
  const selectedBookingDayHour = findSalonHourForDateKey(salonHoursList, bookingDateForSlots);
  const bookingDaySlots = salonDayInfoByKey[bookingDateForSlots]?.slots
    || buildDayBookingSlots(salonDayWindow(selectedBookingDayHour).open, salonDayWindow(selectedBookingDayHour).close, selectedBookingDuration);
  const bookingFreeSlots = salonDayInfoByKey[bookingDateForSlots]?.free || salonFreeSlotsFor(bookingDateForSlots);
  const bookingStaffForTime = (slot) => freeStaffAt(bookingDateForSlots, slot)[0] || "";
  const selectedBookingStaff = bookingStaffForTime(bookingTime) || pickedStaffName || bookingStaffOptions[0]?.name || "";

  // Day chips for the salon form: closed days are left out, except today, which stays visible with
  // its reason so it never silently disappears.
  const salonBookingDayOptions = upcomingSalonTabs
    .filter((tab) => (tab.offset ?? 0) === 0 || !salonDayInfoByKey[tab.dateKey]?.closed)
    .map((tab) => {
      const info = salonDayInfoByKey[tab.dateKey];
      return {
        value: tab.dateKey,
        label: `${tab.label} ${tab.sub || ""}`.trim(),
        free: info.free.length,
        ...describeFullDay(info, tab)
      };
    });

  // Artist side of this same sheet: a real rolling week (not the old fixed
  // "امروز/فردا/پس‌فردا") and slots actually filtered against the artist's
  // own bookings + break time -- previously every hourly slot 09:00-21:00
  // showed as pickable regardless of what was already booked, and a
  // conflict only surfaced after submitting.
  const artistBookingDayOptions = ARTIST_BOOKING_DAY_TABS.map((tab) => ({
    value: tab.dateKey,
    label: `${tab.label} ${tab.sub || ""}`.trim()
  }));
  const artistBookingDayLabel = (value) => ARTIST_BOOKING_DAY_TABS.find((tab) => tab.dateKey === value);
  const artistBookingDateForSlots = artistBookingDayOptions.some((tab) => tab.value === bookingDate)
    ? bookingDate
    : (artistBookingDayOptions[0]?.value || "امروز");
  const selectedArtistService = artistServiceList.find((item) => item.name === bookingServiceName)
    || artistServiceList[0];
  const artistServiceDuration = parseServiceDurationMinutes(selectedArtistService?.duration);
  const artistBookingDaySlots = buildPublicBookingSlots(artistServiceDuration);
  // Everything that holds the artist's time: their own and their salons' bookings alike (the salon
  // ones arrive as mirrors in the same list). Only cancelled or expired ones free the time.
  const artistBookedSlots = artistBookingList
    .filter(bookingHoldsSlot)
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
    salonBookingDayOptions.forEach((option) => { bookingDayFreeCounts[option.value] = option.free; });
  }
  const artistBookingDayOptionsWithFree = artistBookingDayOptions.map((option) => {
    const free = artistFreeSlotsFor(option.value);
    const anyUpcoming = artistBookingDaySlots.some((slot) => !isSlotInPast(option.value, slot, soon));
    const reason = free.length ? "" : (anyUpcoming ? "full" : "over");
    return { ...option, free: free.length, ...describeFullDay({ reason }, artistBookingDayLabel(option.value)) };
  });

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
    bookingStaffName: pickedStaffName,
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
    salonBookingDayOptions,
    artistBookingDayOptions: artistBookingDayOptionsWithFree,
    artistBookingDateForSlots,
    artistBookingFreeSlots,
    selectedArtistService,
    openBookingSheet,
    closeBookingSheet
  };
}
