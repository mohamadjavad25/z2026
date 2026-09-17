"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createSalonBooking,
  getSalonBookings,
  getSalons,
  toggleSalonFollow
} from "../../shared/api/salons";
import { getReviews } from "../../shared/api/reviews";
import { notifyFromResponse } from "../../shared/lib/apiNotify";
import { resolveRollingPersianDateKey } from "../../shared/lib/persianCalendar";
import {
  buildDayBookingSlots,
  parseServiceDurationMinutes,
  rangesOverlap,
  timeLabelToMinutes
} from "../../shared/lib/time";
import { salonClientBookingDays } from "../artist/constants";
import { salonServiceCatalog } from "./constants";

const initialBooking = {
  open: false,
  service: "",
  day: salonClientBookingDays[0] || "",
  time: "۱۰:۰۰",
  client: "",
  phone: "",
  profileConfirmed: false
};

export function getVisibleSalonServiceItems(salon) {
  if (salon?.services?.length) return salon.services.filter((service) => service?.name);
  return [];
}

function getBookableSalonServiceItems(salon) {
  const visible = getVisibleSalonServiceItems(salon);
  return visible.length ? visible : salonServiceCatalog;
}

function normalizeDayLabel(value) {
  return String(value || "").replace(/\s/g, "");
}

function getSalonHourForDay(hours, day) {
  if (!Array.isArray(hours) || !hours.length) return null;
  const dayKey = resolveRollingPersianDateKey(day);
  const dayLabel = normalizeDayLabel(day);
  return hours.find((hour) => (
    normalizeDayLabel(hour?.day) === dayLabel
      || resolveRollingPersianDateKey(hour?.day || "") === dayKey
  )) || null;
}

/**
 * Salon **client** directory: public list, storefront, follow/save, reviews, booking modal.
 *
 * Does NOT own salon-owner dashboard state (salonAppointmentList, hours editor, staff CRUD, …).
 *
 * scheduleNow / scheduleViewDay / scheduleBookingMenu stay in HomeApp (shared with artist owner
 * schedule UI) — see hook note in project report; do not pull those into this hook.
 *
 * @param {{
 *   createdProfile?: { id?: number|string, type?: string, data?: Record<string, unknown> } | null,
 *   onNotice?: (msg: string) => void,
 *   onShellNotice?: (msg: string) => void,
 *   onOwnerBookingsSync?: (bookings: unknown[]) => void,
 *   onLinkedArtistBooked?: (linkedArtistId: number|string) => void
 * }} options
 */
export function useSalonDirectory({
  createdProfile = null,
  onNotice,
  onShellNotice,
  onOwnerBookingsSync,
  onLinkedArtistBooked
} = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const shellMsg = useCallback((message) => {
    if (typeof onShellNotice === "function" && message) onShellNotice(message);
  }, [onShellNotice]);

  const [salonDirectory, setSalonDirectory] = useState([]);
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [followedSalons, setFollowedSalons] = useState([]);
  const [savedSalonKeys, setSavedSalonKeys] = useState([]);
  const [salonClientTab, setSalonClientTab] = useState("services");
  const [salonClientReviews, setSalonClientReviews] = useState([]);
  const [salonClientBooking, setSalonClientBooking] = useState(initialBooking);
  const [salonClientBookingBusy, setSalonClientBookingBusy] = useState(false);
  const [salonClientUnavailableSlots, setSalonClientUnavailableSlots] = useState([]);
  const [clientBookingList, setClientBookingList] = useState([]);

  const savedSalonList = useMemo(() => {
    const source = [...salonDirectory];
    if (selectedSalon) {
      const selectedKey = String(selectedSalon.id || selectedSalon.source_key || selectedSalon.name);
      if (!source.some((salon) => String(salon.id || salon.source_key || salon.name) === selectedKey)) {
        source.unshift(selectedSalon);
      }
    }
    return source.filter((salon) => savedSalonKeys.includes(String(salon.id || salon.source_key || salon.name)));
  }, [salonDirectory, savedSalonKeys, selectedSalon]);

  const salonClientSelectedService = useMemo(() => (
    getBookableSalonServiceItems(selectedSalon)
      .find((service) => String(service?.name || "") === String(salonClientBooking.service || ""))
  ), [selectedSalon, salonClientBooking.service]);

  const salonClientFreeTimes = useMemo(() => {
    const duration = parseServiceDurationMinutes(salonClientSelectedService?.duration);
    const hour = getSalonHourForDay(selectedSalon?.hours, salonClientBooking.day);
    if (hour && !Number(hour.active)) return [];
    const baseSlots = buildDayBookingSlots(
      hour?.open_time || "۱۰:۰۰",
      hour?.close_time || "۲۰:۰۰",
      duration
    );
    const selectedDateKey = resolveRollingPersianDateKey(salonClientBooking.day);
    return baseSlots.filter((time) => {
      const start = timeLabelToMinutes(time);
      const end = start + duration;
      return !salonClientUnavailableSlots.some((slot) => {
        if (resolveRollingPersianDateKey(slot.booking_date || slot.date || "") !== selectedDateKey) return false;
        const bookedStart = timeLabelToMinutes(slot.time || "");
        const bookedEnd = bookedStart + Math.max(15, Number(slot.duration_minutes || slot.durationMinutes) || 60);
        return rangesOverlap(start, end, bookedStart, bookedEnd);
      });
    });
  }, [
    selectedSalon,
    salonClientUnavailableSlots,
    salonClientBooking.day,
    salonClientSelectedService
  ]);

  const isFollowingSelectedSalon = selectedSalon
    ? followedSalons.includes(String(selectedSalon.id || selectedSalon.source_key || selectedSalon.name))
    : false;

  const isSavedSelectedSalon = selectedSalon
    ? savedSalonKeys.includes(String(selectedSalon.id || selectedSalon.source_key || selectedSalon.name))
    : false;

  const refreshSalonDirectory = useCallback(async () => {
    try {
      const { ok, data, payload } = await getSalons();
      if (!ok) return;
      setSalonDirectory(data?.salons || payload?.salons || []);
    } catch {
      // keep current directory
    }
  }, []);

  const refreshClientBookings = useCallback(async () => {
    try {
      const { ok, data, payload } = await getSalonBookings();
      if (!ok) return;
      setClientBookingList(data?.bookings || payload?.bookings || []);
    } catch {
      // keep current client bookings
    }
  }, []);

  const resetSalonClient = useCallback(() => {
    setSelectedSalon(null);
    setFollowedSalons([]);
    setSavedSalonKeys([]);
    setSalonClientTab("services");
    setSalonClientReviews([]);
    setSalonClientBooking(initialBooking);
    setSalonClientBookingBusy(false);
    setSalonClientUnavailableSlots([]);
    setClientBookingList([]);
  }, []);

  useEffect(() => {
    if (!selectedSalon) {
      setSalonClientReviews([]);
      return undefined;
    }
    setSalonClientTab("services");
    const salonUserId = selectedSalon.id || selectedSalon.source_key;
    if (!salonUserId) {
      setSalonClientReviews([]);
      return undefined;
    }
    let cancelled = false;
    getReviews(salonUserId)
      .then(({ ok, data }) => {
        if (!cancelled) setSalonClientReviews(ok ? (data?.reviews || []) : []);
      })
      .catch(() => {
        if (!cancelled) setSalonClientReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSalon?.id, selectedSalon?.source_key]);

  useEffect(() => {
    if (!salonClientBooking.open || !selectedSalon) return undefined;
    const salonUserId = selectedSalon.id || selectedSalon.source_key;
    if (!salonUserId) return undefined;
    let cancelled = false;
    getSalonBookings(salonUserId)
      .then(({ data, payload }) => {
        if (!cancelled) {
          setSalonClientUnavailableSlots(data?.unavailableSlots || payload?.unavailableSlots || []);
          const hours = data?.hours || payload?.hours;
          if (Array.isArray(hours) && hours.length) {
            setSelectedSalon((current) => (
              current && String(current.id || current.source_key) === String(salonUserId)
                ? { ...current, hours }
                : current
            ));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setSalonClientUnavailableSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [salonClientBooking.open, selectedSalon?.id, selectedSalon?.source_key]);

  useEffect(() => {
    if (!salonClientBooking.open || !salonClientFreeTimes.length) return;
    if (!salonClientFreeTimes.includes(salonClientBooking.time)) {
      setSalonClientBooking((current) => ({ ...current, time: salonClientFreeTimes[0] }));
    }
  }, [salonClientBooking.open, salonClientBooking.day, salonClientBooking.time, salonClientFreeTimes]);

  useEffect(() => {
    if (createdProfile?.type !== "client") return undefined;
    refreshClientBookings();
    const timer = window.setInterval(refreshClientBookings, 8000);
    return () => window.clearInterval(timer);
  }, [createdProfile?.type, refreshClientBookings]);

  const toggleFollowSalon = useCallback(async (salon) => {
    const followKey = String(salon.id || salon.source_key || salon.name);
    const previousFollowed = followedSalons.includes(followKey);
    const nextFollowed = !previousFollowed;

    setFollowedSalons((items) => {
      if (items.includes(followKey)) {
        return items.filter((item) => item !== followKey);
      }
      return [...items, followKey];
    });

    try {
      const result = await toggleSalonFollow({
        salonUserId: salon.id || Number(salon.source_key),
        follow: nextFollowed
      });
      if (!notifyFromResponse(notify, result, {
        failure: "ذخیره فالو انجام نشد؛ دوباره امتحان کن."
      })) {
        setFollowedSalons((items) => {
          if (previousFollowed) {
            return items.includes(followKey) ? items : [...items, followKey];
          }
          return items.filter((item) => item !== followKey);
        });
        return;
      }
      const follow = result.payload?.follow || result.payload?.data || result.payload;
      if (follow) {
        setSelectedSalon((current) => (
          current ? { ...current, follower_count: follow.follower_count ?? follow.followerCount } : current
        ));
        setSalonDirectory((items) => items.map((item) => (
          String(item.id || item.source_key) === followKey
            ? { ...item, follower_count: follow.follower_count ?? follow.followerCount }
            : item
        )));
      }
    } catch {
      setFollowedSalons((items) => {
        if (previousFollowed) {
          return items.includes(followKey) ? items : [...items, followKey];
        }
        return items.filter((item) => item !== followKey);
      });
      notify("ذخیره فالو انجام نشد؛ دوباره امتحان کن.");
    }
  }, [followedSalons, notify]);

  const toggleSaveSalon = useCallback((salon) => {
    const key = String(salon.id || salon.source_key || salon.name);
    const willSave = !savedSalonKeys.includes(key);
    setSavedSalonKeys((items) => (
      items.includes(key) ? items.filter((item) => item !== key) : [...items, key]
    ));
    notify(willSave ? "سالن ذخیره شد." : "سالن از ذخیره‌ها حذف شد.");
  }, [savedSalonKeys, notify]);

  const shareSalonProfile = useCallback(async (nameHint) => {
    const name = nameHint || selectedSalon?.name || createdProfile?.data?.name || "سالن";
    const shareText = `پروفایل سالن «${name}» در زیبابان`;
    const salonId = selectedSalon?.id ?? selectedSalon?.source_key;
    const shareUrl = typeof window !== "undefined"
      ? (salonId ? `${window.location.origin}/salons/${salonId}` : window.location.href)
      : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: name, text: shareText, url: shareUrl });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        notify(`لینک پروفایل «${name}» کپی شد.`);
        return;
      }
    } catch {
      // cancelled
    }
    notify(`لینک پروفایل «${name}» آماده اشتراک‌گذاری است.`);
  }, [createdProfile, notify, selectedSalon]);

  const openSalonClientBooking = useCallback((serviceName = "") => {
    if (!selectedSalon) return;
    const serviceItems = getBookableSalonServiceItems(selectedSalon);
    const nextService = serviceName || serviceItems[0]?.name || "";
    if (!nextService) {
      shellMsg("این سالن هنوز خدمتی برای رزرو ثبت نکرده است.");
      return;
    }
    setSalonClientTab("services");
    setSalonClientBooking((current) => ({
      open: true,
      service: nextService,
      day: current.day || salonClientBookingDays[0] || "",
        time: current.time || getSalonHourForDay(selectedSalon.hours, current.day)?.open_time || "۱۰:۰۰",
      client: current.client || createdProfile?.data?.name || "",
      phone: current.phone || createdProfile?.data?.phone || "",
      profileConfirmed: false
    }));
  }, [selectedSalon, createdProfile, shellMsg]);

  const closeSalonClientBooking = useCallback(() => {
    setSalonClientBooking((current) => ({ ...current, open: false }));
  }, []);

  const patchSalonClientBooking = useCallback((patch) => {
    setSalonClientBooking((current) => ({ ...current, ...patch }));
  }, []);

  const confirmSalonClientBooking = useCallback(async (options = {}) => {
    if (!selectedSalon || !salonClientBooking.service) {
      shellMsg("اول یک خدمت را انتخاب کن.");
      return;
    }
    const salonUserId = selectedSalon.id || selectedSalon.source_key;
    if (!salonUserId) {
      shellMsg("شناسه سالن برای ثبت رزرو پیدا نشد.");
      return;
    }
    if (!salonClientFreeTimes.includes(salonClientBooking.time)) {
      shellMsg("این ساعت دیگر آزاد نیست؛ یک ساعت دیگر انتخاب کن.");
      return;
    }
    const profileConfirmed = Boolean(options.profileConfirmed || salonClientBooking.profileConfirmed);
    if (!profileConfirmed) {
      shellMsg("برای ثبت رزرو، اول اطلاعات پروفایل را تایید کن.");
      return;
    }
    if (options.profileConfirmed && !salonClientBooking.profileConfirmed) {
      setSalonClientBooking((current) => ({ ...current, profileConfirmed: true }));
    }
    setSalonClientBookingBusy(true);
    try {
      const durationMinutes = parseServiceDurationMinutes(salonClientSelectedService?.duration);
      const { ok, payload, status } = await createSalonBooking({
        salonUserId,
        client: salonClientBooking.client || createdProfile?.data?.name || "مشتری زیبابان",
        phone: salonClientBooking.phone || createdProfile?.data?.phone || "",
        service: salonClientBooking.service,
        staff: "",
        bookingDate: salonClientBooking.day,
        time: salonClientBooking.time,
        durationMinutes,
        status: "درخواست"
      });
      if (!ok) {
        shellMsg(payload?.error || "این زمان قابل رزرو نیست.");
        return { ok: false, status, payload };
      }
      if (String(salonUserId) === String(createdProfile?.id) && typeof onOwnerBookingsSync === "function") {
        onOwnerBookingsSync(payload?.bookings || []);
      }
      const linkedArtistId = payload?.linkedArtistId;
      if (linkedArtistId && typeof onLinkedArtistBooked === "function") {
        try {
          await onLinkedArtistBooked(linkedArtistId);
        } catch {
          // artist refresh is best-effort; salon booking already succeeded
        }
      }
      if (payload?.booking) {
        setSalonClientUnavailableSlots((slots) => [
          ...slots,
          {
            booking_date: payload.booking.booking_date,
            time: payload.booking.time,
            duration_minutes: payload.booking.duration_minutes || durationMinutes
          }
        ]);
        setClientBookingList((items) => [
          {
            ...payload.booking,
            salonName: selectedSalon.name,
            salonArea: selectedSalon.area,
            salonPhone: selectedSalon.phone,
            salonAvatar: selectedSalon.avatar,
            service: salonClientBooking.service,
            booking_date: payload.booking.booking_date || salonClientBooking.day,
            time: payload.booking.time || salonClientBooking.time,
            status: payload.booking.status || "درخواست"
          },
          ...items
        ]);
      }
      setSalonClientBooking((current) => ({ ...current, open: false }));
      shellMsg("رزرو با موفقیت ثبت شد.");
      notify(`رزرو ${salonClientBooking.service} برای ${salonClientBooking.day} ساعت ${salonClientBooking.time} ثبت شد.`);
      return { ok: true, payload };
    } catch {
      shellMsg("ثبت رزرو انجام نشد؛ دوباره امتحان کن.");
      return { ok: false };
    } finally {
      setSalonClientBookingBusy(false);
    }
  }, [
    selectedSalon,
    salonClientBooking,
    salonClientFreeTimes,
    salonClientSelectedService,
    createdProfile,
    onOwnerBookingsSync,
    onLinkedArtistBooked,
    shellMsg,
    notify
  ]);

  return {
    salonDirectory,
    setSalonDirectory,
    selectedSalon,
    setSelectedSalon,
    followedSalons,
    setFollowedSalons,
    savedSalonKeys,
    setSavedSalonKeys,
    salonClientTab,
    setSalonClientTab,
    salonClientReviews,
    setSalonClientReviews,
    salonClientBooking,
    setSalonClientBooking,
    salonClientBookingBusy,
    salonClientUnavailableSlots,
    setSalonClientUnavailableSlots,
    clientBookingList,
    setClientBookingList,
    savedSalonList,
    salonClientFreeTimes,
    isFollowingSelectedSalon,
    isSavedSelectedSalon,
    refreshSalonDirectory,
    refreshClientBookings,
    resetSalonClient,
    toggleFollowSalon,
    toggleSaveSalon,
    shareSalonProfile,
    openSalonClientBooking,
    closeSalonClientBooking,
    patchSalonClientBooking,
    confirmSalonClientBooking,
    getVisibleSalonServiceItems
  };
}
