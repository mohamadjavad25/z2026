import { useMemo, useEffect } from "react";
import { useAppSounds } from "./useAppSounds";
import { SALON_HOUR_TIME_OPTIONS, timeLabelToMinutes } from "../../shared/lib/time";
import { buildBookingCustomers, computeStaffStats } from "../salons";
import { getBookingDateKey, getBookingDateOffsetDays, buildExactBookingDateTabsCentered, isArtistBookingOnSelectedDay, isArtistBookingOnExactDate } from "../artist";
import { isPersianDateKey, formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { toPersianDigits } from "../../shared/lib/digits";
import { isWithinLastHours } from "./homeAppHelpers";
import { preloadImages, thumbUrl } from "../../shared/lib/mediaUrl";
import { normalizeSalonScheduleBooking, withScheduleTimeline, normalizeArtistScheduleBooking } from "../profile/ScheduleRow";

export function useScheduleViews({
  salonHoursList,
  activeSalonHours,
  selectedSalonHourDay,
  salonAppointmentList,
  createdProfile,
  artistBookingList,
  selectedArtistProfile,
  salonServiceList,
  scheduleViewDay,
  salonScheduleWeekTabs,
  artistBookingSelectedDay,
  salonPortfolioList,
  artistPortfolioItems,
  selectedSalon,
  reservationRequestList,
  pendingSalonCollabRequests,
  pendingArtistSalonInvites,
  profileSettings,
  appToast,
  clientBookingList,
  setAppToast,
  salonStaffByName,
  scheduleNow,
  artistServiceList
}) {
  const salonHoursPresets = [
    { id: "standard", label: "معمولی", detail: "شنبه تا چهارشنبه • ۱۰ تا ۲۰ • ظرفیت ۸" },
    { id: "extended", label: "پرفشار", detail: "همه روزها باز • ۱۰ تا ۲۲ • ظرفیت ۱۲" },
    { id: "weekend", label: "آخر هفته", detail: "پنجشنبه و جمعه • ۱۲ تا ۱۸ • ظرفیت ۵" }
  ];
  const activeHoursPreset = useMemo(() => {
    if (!salonHoursList.length) return null;
    const weekendDays = new Set(["پنجشنبه", "جمعه"]);
    const matches = (predicate) => salonHoursList.every(predicate);
    if (matches((hour) => {
      const isWeekend = weekendDays.has(hour.day);
      return hour.open_time === "۱۰:۰۰" && hour.close_time === "۲۰:۰۰" && Number(hour.capacity) === 8 && Boolean(hour.active) === !isWeekend;
    })) return "standard";
    if (matches((hour) => hour.open_time === "۱۰:۰۰" && hour.close_time === "۲۲:۰۰" && Number(hour.capacity) === 12 && Boolean(hour.active))) return "extended";
    if (matches((hour) => {
      const isWeekend = weekendDays.has(hour.day);
      return hour.open_time === "۱۲:۰۰" && hour.close_time === "۱۸:۰۰" && Number(hour.capacity) === 5 && Boolean(hour.active) === isWeekend;
    })) return "weekend";
    return null;
  }, [salonHoursList]);
  const activeHoursPresetMeta = salonHoursPresets.find((preset) => preset.id === activeHoursPreset) || null;
  const weeklyCapacityTotal = activeSalonHours.reduce((total, item) => total + Number(item.capacity || 0), 0);
  const selectedSalonHour = useMemo(() => {
    if (!salonHoursList.length) return null;
    return salonHoursList.find((hour) => hour.day === selectedSalonHourDay)
      || salonHoursList.find((hour) => hour.active)
      || salonHoursList[0]
      || null;
  }, [salonHoursList, selectedSalonHourDay]);
  const salonHourTimeOptions = useMemo(() => {
    const options = [...SALON_HOUR_TIME_OPTIONS];
    [selectedSalonHour?.open_time, selectedSalonHour?.close_time].forEach((value) => {
      if (value && !options.includes(value)) options.push(value);
    });
    return options;
  }, [selectedSalonHour]);
  const scheduleDayOptions = useMemo(() => {
    const fromHours = salonHoursList.map((hour) => hour.day).filter(Boolean);
    const fromBookings = salonAppointmentList
      .filter((item) => item.status !== "لغو")
      .map((item) => item.booking_date || item.date || "امروز")
      .filter(Boolean);
    const unique = [];
    [...fromHours, ...fromBookings].forEach((day) => {
      if (!unique.includes(day)) unique.push(day);
    });
    return unique.length ? unique : ["امروز"];
  }, [salonHoursList, salonAppointmentList]);

  const bookingCustomerOptions = useMemo(() => (
    buildBookingCustomers(createdProfile?.type === "artist" ? artistBookingList : salonAppointmentList)
  ), [createdProfile?.type, artistBookingList, salonAppointmentList]);

  const selectedStaffStats = useMemo(() => (
    selectedArtistProfile
      ? computeStaffStats(selectedArtistProfile, salonAppointmentList, salonServiceList)
      : null
  ), [selectedArtistProfile, salonAppointmentList, salonServiceList]);

  const salonHistoryAppointments = useMemo(() => (
    salonAppointmentList
      .filter((item) => item.status !== "لغو")
      .map((item) => ({
        ...item,
        date: item.booking_date || item.date || "امروز",
        dateKey: getBookingDateKey(item.booking_date || item.date || "امروز")
      }))
  ), [salonAppointmentList]);

  // Unrestricted-scroll range for the salon hero week strip: `daysBefore`
  // reaches back several months by default (extended further if an older
  // booking actually exists), while `daysAfter` only reaches as far into
  // the future as the salon's own bookings go — there's nothing useful to
  // scroll to on an empty future day. Both are capped so the rail never
  // has to render an unbounded number of cells.
  const SALON_HERO_MIN_PAST_DAYS = 180;
  const SALON_HERO_MAX_PAST_DAYS = 365;
  const SALON_HERO_MAX_FUTURE_DAYS = 365;
  const salonHeroWeekRangeBounds = useMemo(() => {
    let pastDays = SALON_HERO_MIN_PAST_DAYS;
    let futureDays = 0;
    salonHistoryAppointments.forEach((item) => {
      if (!item.dateKey) return;
      const offset = getBookingDateOffsetDays(item.dateKey);
      if (offset < 0) {
        pastDays = Math.min(SALON_HERO_MAX_PAST_DAYS, Math.max(pastDays, -offset));
      } else if (offset > futureDays) {
        futureDays = Math.min(SALON_HERO_MAX_FUTURE_DAYS, offset);
      }
    });
    return { pastDays, futureDays };
  }, [salonHistoryAppointments]);

  const salonHeroWeekRange = useMemo(
    () => buildExactBookingDateTabsCentered(salonHeroWeekRangeBounds.pastDays, salonHeroWeekRangeBounds.futureDays),
    [salonHeroWeekRangeBounds]
  );

  const activeScheduleDay = useMemo(() => {
    const weekDays = salonScheduleWeekTabs.map((item) => item.day);
    // An explicit selection from the wide-range hero strip arrives as an
    // absolute dateKey ("1404-06-11"), not a weekday name — accept it
    // directly rather than requiring it show up in the narrow (7-tab)
    // weekDays/scheduleDayOptions lists below, which only ever cover a
    // single week and would otherwise silently discard it back to today.
    if (scheduleViewDay && isPersianDateKey(scheduleViewDay)) return scheduleViewDay;
    if (scheduleViewDay && weekDays.includes(scheduleViewDay)) return scheduleViewDay;
    if (scheduleViewDay && scheduleDayOptions.includes(scheduleViewDay)) {
      const selectedDateKey = getBookingDateKey(scheduleViewDay);
      const matched = salonScheduleWeekTabs.find((item) => item.dateKey === selectedDateKey)?.day
        || weekDays.find((day) => isArtistBookingOnSelectedDay({ date: scheduleViewDay }, day));
      if (matched) return matched;
    }
    // Default (no explicit selection yet): today. salonScheduleWeekTabs is
    // now centered on today (not today-first), so find it explicitly rather
    // than assuming index 0 — and do NOT prefer "the first day that happens
    // to have a booking" here, that silently jumps the view away from today
    // whenever today is empty.
    const todayTab = salonScheduleWeekTabs.find((item) => item.label === "امروز");
    return todayTab?.day || weekDays[0] || scheduleDayOptions[0] || "امروز";
  }, [scheduleViewDay, salonScheduleWeekTabs, scheduleDayOptions]);

  const activeScheduleDayLabel = useMemo(() => {
    const narrowLabel = salonScheduleWeekTabs.find((item) => item.day === activeScheduleDay)?.label;
    if (narrowLabel) return narrowLabel;
    if (isPersianDateKey(activeScheduleDay)) return formatRelativeBookingDayLabel(activeScheduleDay);
    return activeScheduleDay;
  }, [salonScheduleWeekTabs, activeScheduleDay]);

  // Absolute dateKey for whichever day is actually selected, regardless of
  // whether activeScheduleDay is a narrow-window weekday name (default /
  // dashboard-tab selections) or already an absolute dateKey (wide-range
  // hero strip selections) — this is what the hero strip itself needs to
  // know which of its (dateKey-identified) cells to highlight.
  const activeScheduleDateKey = useMemo(() => (
    salonScheduleWeekTabs.find((tab) => tab.day === activeScheduleDay)?.dateKey || getBookingDateKey(activeScheduleDay)
  ), [salonScheduleWeekTabs, activeScheduleDay]);

  // Real (non-hardcoded) day tabs for the profile-hero week strip: built
  // from the same rolling-week tabs and exact-date booking counts as the
  // schedule dashboard below, so both stay in sync and "today" is whichever
  // tab actually has today's real dateKey — never a fixed guess.
  const salonHeroWeekTabs = useMemo(() => (
    salonHeroWeekRange.map((tab) => {
      const count = salonHistoryAppointments.filter((item) => (
        isArtistBookingOnExactDate(item, tab.dateKey)
      )).length;
      const isToday = tab.dateKey === getBookingDateKey("امروز");
      return {
        // `day` carries the dateKey (not the bare weekday name): this range
        // spans many weeks, so weekday names repeat and can't uniquely
        // identify a cell. ProfileHeroWeekStrip falls back to `day` as its
        // click/key value when `id` isn't set, so this makes every cell in
        // the wide range uniquely selectable and directly comparable with
        // activeScheduleDateKey below.
        day: tab.dateKey,
        label: tab.day,
        meta: isToday ? "امروز" : tab.sub,
        state: count > 0 ? `${toPersianDigits(count)} نوبت` : "بدون نوبت",
        isToday,
        dateKey: tab.dateKey
      };
    })
  ), [salonHeroWeekRange, salonHistoryAppointments]);

  // Same ProfileHeroWeekStrip, same wide unrestricted-scroll range, for the
  // artist's bookings tab (ArtistScheduleBoard) — mirrors salonHeroWeekRange*
  // above exactly, just keyed off artistBookingList. Unlike the salon side,
  // there's no separate narrow (weekday-name) widget to reconcile with here
  // (ArtistScheduleBoard has only this one day-picker), so the selection
  // logic below is simpler than activeScheduleDay/activeScheduleDateKey.
  const artistWeekRangeBounds = useMemo(() => {
    let pastDays = SALON_HERO_MIN_PAST_DAYS;
    let futureDays = 0;
    artistBookingList.forEach((item) => {
      if (!item.dateKey) return;
      const offset = getBookingDateOffsetDays(item.dateKey);
      if (offset < 0) {
        pastDays = Math.min(SALON_HERO_MAX_PAST_DAYS, Math.max(pastDays, -offset));
      } else if (offset > futureDays) {
        futureDays = Math.min(SALON_HERO_MAX_FUTURE_DAYS, offset);
      }
    });
    return { pastDays, futureDays };
  }, [artistBookingList]);

  const artistWeekRange = useMemo(
    () => buildExactBookingDateTabsCentered(artistWeekRangeBounds.pastDays, artistWeekRangeBounds.futureDays),
    [artistWeekRangeBounds]
  );

  // artistBookingSelectedDay starts out as a bare weekday name (today's,
  // from useArtistWorkspace's initial state) and becomes an absolute
  // dateKey once the user picks any cell from this wide-range strip —
  // getBookingDateKey resolves either shape to a real dateKey.
  const activeArtistScheduleDateKey = useMemo(
    () => getBookingDateKey(artistBookingSelectedDay),
    [artistBookingSelectedDay]
  );

  const activeArtistScheduleDayLabel = useMemo(
    () => formatRelativeBookingDayLabel(activeArtistScheduleDateKey),
    [activeArtistScheduleDateKey]
  );

  const artistBookingsWeekTabs = useMemo(() => (
    artistWeekRange.map((tab) => {
      const count = artistBookingList.filter((item) => (
        isArtistBookingOnExactDate(item, tab.dateKey)
      )).length;
      const isToday = tab.dateKey === getBookingDateKey("امروز");
      return {
        // dateKey, not the bare weekday name, for the same reason as the
        // salon version above: this range spans many weeks, so weekday
        // names repeat and can't uniquely identify a cell.
        day: tab.dateKey,
        label: tab.day,
        meta: isToday ? "امروز" : tab.sub,
        state: count > 0 ? `${toPersianDigits(count)} نوبت` : "بدون نوبت",
        isToday,
        dateKey: tab.dateKey
      };
    })
  ), [artistWeekRange, artistBookingList]);

  // Real bookings not yet accepted/declined, for the artist notifications
  // sheet below. Unlike the salon panel's reservationRequestList (still
  // backed by shell/mockData — a separate, pre-existing issue, not fixed
  // here), this reads real artistBookingList. "تازه"/"درخواست" = not yet
  // reviewed; "لغو" (cancelled) never counts as pending. Only the artist's own (direct) bookings:
  // one a salon gives them is the salon's to accept, and the artist just does it.
  const pendingArtistBookingRequests = useMemo(() => (
    artistBookingList.filter((item) => !item.sourceSalon && (item.status === "تازه" || item.status === "درخواست"))
  ), [artistBookingList]);

  // Auto-expiry (see app/lib/bookingExpirySweep.js) silently flips a stale
  // request's status away from "درخواست"/"تازه" — it DROPS OUT of the pending
  // lists above with zero signal to the owner that anything happened (the
  // client gets a push notification; the salon/artist previously got nothing
  // at all). Surfaced here as its own read-only "recently expired" list (last 24h,
  // by created_at) so the notifications sheet can show it — informational
  // only, no approve/decline actions, since the window already closed.
  const recentlyExpiredSalonBookings = useMemo(() => (
    salonAppointmentList.filter((booking) => (
      booking.status === "منقضی شده" && isWithinLastHours(booking.created_at, 24)
    ))
  ), [salonAppointmentList]);

  const recentlyExpiredArtistBookings = useMemo(() => (
    artistBookingList.filter((item) => (
      item.status === "منقضی شده" && isWithinLastHours(item.createdAt, 24)
    ))
  ), [artistBookingList]);

  // Warm the browser cache with the gallery thumbnails as soon as the lists arrive, so opening a
  // gallery tab shows pictures at once instead of loading them after the tab appears.
  useEffect(() => {
    const lists = [salonPortfolioList, artistPortfolioItems, selectedSalon?.portfolio];
    const urls = lists.flatMap((list) => (Array.isArray(list) ? list.slice(0, 12) : []))
      .map((item) => thumbUrl(item?.image, 480));
    preloadImages(urls);
  }, [salonPortfolioList, artistPortfolioItems, selectedSalon?.portfolio]);

  // Sounds for arriving requests / invites / status changes, toasts and the appointment alarm.
  const salonRequestIds = useMemo(() => reservationRequestList.map((item) => item.id), [reservationRequestList]);
  const artistRequestIds = useMemo(() => pendingArtistBookingRequests.map((item) => item.id), [pendingArtistBookingRequests]);
  const soundInviteIds = useMemo(() => (
    createdProfile?.type === "salon"
      ? pendingSalonCollabRequests.map((item) => item.id)
      : pendingArtistSalonInvites.map((item) => item.id)
  ), [createdProfile?.type, pendingSalonCollabRequests, pendingArtistSalonInvites]);
  useAppSounds({
    profile: createdProfile,
    alertsOn: profileSettings.reservationAlerts !== false,
    toast: appToast,
    clientBookings: clientBookingList,
    salonBookings: salonAppointmentList,
    artistBookings: artistBookingList,
    salonRequestIds,
    artistRequestIds,
    inviteIds: soundInviteIds,
    onReminder: setAppToast
  });

  const scheduleDayAppointments = useMemo(() => (
    salonHistoryAppointments
      .filter((item) => isArtistBookingOnExactDate(item, activeScheduleDateKey))
      .map((item) => normalizeSalonScheduleBooking(item, salonStaffByName, salonServiceList))
      .map((item) => withScheduleTimeline(item, {
        // Deliberately activeScheduleDay (not activeScheduleDateKey) here:
        // the timeline phase logic (live/done/upcoming) only special-cases
        // "today" via getArtistBookingDayRank, which recognizes both
        // weekday names/"امروز" AND an absolute dateKey that resolves to
        // today — either shape works, and activeScheduleDay is what's
        // already in scope from a real user selection.
        selectedDay: activeScheduleDay,
        now: scheduleNow
      }))
      .sort((a, b) => timeLabelToMinutes(a.time) - timeLabelToMinutes(b.time))
  ), [salonHistoryAppointments, activeScheduleDay, activeScheduleDateKey, salonStaffByName, salonServiceList, scheduleNow]);

  const artistScheduleDayRows = useMemo(() => (
    artistBookingList
      .filter((booking) => isArtistBookingOnExactDate(booking, activeArtistScheduleDateKey))
      .map((booking) => normalizeArtistScheduleBooking(booking, artistServiceList))
      .map((booking) => withScheduleTimeline(booking, {
        selectedDay: activeArtistScheduleDateKey,
        now: scheduleNow
      }))
      .sort((a, b) => timeLabelToMinutes(a.time) - timeLabelToMinutes(b.time))
  ), [artistBookingList, activeArtistScheduleDateKey, artistServiceList, scheduleNow]);

  return {
    salonHoursPresets,
    activeHoursPreset,
    activeHoursPresetMeta,
    weeklyCapacityTotal,
    selectedSalonHour,
    salonHourTimeOptions,
    bookingCustomerOptions,
    selectedStaffStats,
    salonHistoryAppointments,
    activeScheduleDay,
    activeScheduleDayLabel,
    activeScheduleDateKey,
    salonHeroWeekTabs,
    activeArtistScheduleDateKey,
    activeArtistScheduleDayLabel,
    artistBookingsWeekTabs,
    pendingArtistBookingRequests,
    recentlyExpiredSalonBookings,
    recentlyExpiredArtistBookings,
    scheduleDayAppointments,
    artistScheduleDayRows
  };
}
