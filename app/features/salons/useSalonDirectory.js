"use client";

import { isSlotInPast } from "../../shared/lib/slots";
import { playSound } from "../../shared/lib/sounds";
import { usePolling } from "../../shared/lib/usePolling";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createSalonBooking,
  getSalonBookings,
  getSalons,
  toggleSalonFollow
} from "../../shared/api/salons";
import { getClientBookings } from "../../shared/api/artists";
import { toggleSave } from "../../shared/api/saves";
import { apiFetch } from "../../shared/api/client";
import { notifyFromResponse } from "../../shared/lib/apiNotify";
import { resolveRollingPersianDateKey } from "../../shared/lib/persianCalendar";
import { bookingIsOnDateKey, findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "../../shared/lib/salonAvailability";
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

function getSalonHourForDay(hours, day) {
  return findSalonHourForDateKey(hours, resolveRollingPersianDateKey(day));
}

/**
 * Salon **client** directory: public list, storefront, follow/save, booking modal.
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

  // Every salon (public list); used to resolve salons opened from posts,
  // bookings and saved items. Clients browse their own salons in features/connect.
  const [salonDirectory, setSalonDirectory] = useState([]);
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [followedSalons, setFollowedSalons] = useState([]);
  const [savedSalonKeys, setSavedSalonKeys] = useState([]);
  const [salonClientTab, setSalonClientTab] = useState("services");
  const [salonClientBooking, setSalonClientBooking] = useState(initialBooking);
  const [salonClientBookingBusy, setSalonClientBookingBusy] = useState(false);
  const [salonClientUnavailableSlots, setSalonClientUnavailableSlots] = useState([]);
  const [clientBookingList, setClientBookingList] = useState([]);
  const autoAdvanceDayRef = useRef(true);

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
    (salonClientBooking.bundle?.name === salonClientBooking.service ? salonClientBooking.bundle : null)
    || getBookableSalonServiceItems(selectedSalon)
      .find((service) => String(service?.name || "") === String(salonClientBooking.service || ""))
  ), [selectedSalon, salonClientBooking.service, salonClientBooking.bundle]);

  const salonClientFreeTimes = useMemo(() => {
    const duration = parseServiceDurationMinutes(salonClientSelectedService?.duration);
    const hour = getSalonHourForDay(selectedSalon?.hours, salonClientBooking.day);
    if (!isSalonHourOpen(hour)) return [];
    const dayWindow = salonDayWindow(hour);
    const baseSlots = buildDayBookingSlots(dayWindow.open, dayWindow.close, duration);
    const selectedDateKey = resolveRollingPersianDateKey(salonClientBooking.day);
    return baseSlots.filter((time) => {
      if (isSlotInPast(salonClientBooking.day, time)) return false;
      const start = timeLabelToMinutes(time);
      const end = start + duration;
      return !salonClientUnavailableSlots.some((slot) => {
        if (!bookingIsOnDateKey(slot, selectedDateKey)) return false;
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
    // Salon bookings (salon_bookings table) + the client's own direct
    // artist bookings (artist_bookings table, /api/artist-bookings) —
    // merged into one list so "فعالیت من" shows every real booking, not
    // just salon ones. See listClientArtistBookings in
    // app/lib/db/repos/artists.js for why the artist rows already carry
    // salonName/salon_name (reused field, safe for existing rendering)
    // alongside their own artistUserId/bookingSource (kept distinct, used
    // by HomeApp's rebookFromBooking to route to the right profile type).
    let salonBookings = null;
    let artistBookings = null; // null (not []) on failure so a hiccup can't erase what is already shown
    try {
      const result = await getClientBookings();
      if (result.ok) {
        salonBookings = result.data?.salonBookings || [];
        artistBookings = result.data?.artistBookings || [];
      }
    } catch {
      // keep the current list
    }
    if (salonBookings === null && artistBookings === null) return; // both fetches failed: keep current list untouched
    setClientBookingList((previous) => {
      const previousList = previous || [];
      // bookingSource: "artist" is only ever set on rows from listClientArtistBookings
      // (see app/lib/db/repos/artists.js) — salon rows never carry it — so this split
      // cleanly separates "the salon half" from "the artist half" of the merged list.
      const nextSalonBookings = salonBookings ?? previousList.filter((item) => item.bookingSource !== "artist");
      const nextArtistBookings = artistBookings ?? previousList.filter((item) => item.bookingSource === "artist");
      return [...nextSalonBookings, ...nextArtistBookings];
    });
  }, []);

  /** The client cancels one of their own bookings (salon or direct-artist). */
  const cancelClientBooking = useCallback(async (booking) => {
    if (!booking?.id) return false;
    const isArtist = booking.bookingSource === "artist";
    try {
      const { ok, payload } = await apiFetch(`/api/${isArtist ? "artist-bookings" : "salon-bookings"}/${booking.id}/cancel`, {
        method: "POST",
        body: "{}"
      });
      if (!ok) {
        notify(payload?.error || "لغو رزرو انجام نشد.");
        return false;
      }
      setClientBookingList((list) => list.map((item) => (
        item.id === booking.id && (item.bookingSource === "artist") === isArtist ? { ...item, status: "لغو" } : item
      )));
      notify("رزرو لغو شد.");
      return true;
    } catch {
      notify("لغو رزرو انجام نشد؛ دوباره امتحان کن.");
      return false;
    }
  }, [notify]);

  const resetSalonClient = useCallback(() => {
    setSelectedSalon(null);
    setFollowedSalons([]);
    setSavedSalonKeys([]);
    setSalonClientTab("services");
    setSalonClientBooking(initialBooking);
    setSalonClientBookingBusy(false);
    setSalonClientUnavailableSlots([]);
    setClientBookingList([]);
  }, []);

  useEffect(() => {
    if (!selectedSalon) return;
    setSalonClientTab("services");
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

  // Opening the sheet late in the day (or on a closed / full day): move on to the first day that
  // has a free hour, until the client picks a day themselves.
  useEffect(() => {
    if (!salonClientBooking.open || !autoAdvanceDayRef.current || salonClientFreeTimes.length) return;
    const index = salonClientBookingDays.indexOf(salonClientBooking.day);
    if (index < 0 || index >= salonClientBookingDays.length - 1) return;
    setSalonClientBooking((current) => ({ ...current, day: salonClientBookingDays[index + 1] }));
  }, [salonClientBooking.open, salonClientBooking.day, salonClientFreeTimes]);

  useEffect(() => {
    if (!salonClientBooking.open || !salonClientFreeTimes.length) return;
    if (!salonClientFreeTimes.includes(salonClientBooking.time)) {
      setSalonClientBooking((current) => ({ ...current, time: salonClientFreeTimes[0] }));
    }
  }, [salonClientBooking.open, salonClientBooking.day, salonClientBooking.time, salonClientFreeTimes]);

  // Fast while a request is waiting for an answer, slow otherwise (every poll is a function call).
  const hasWaitingBooking = clientBookingList.some((item) => item.status === "درخواست" || item.status === "تازه");
  usePolling(refreshClientBookings, hasWaitingBooking ? 8000 : 45000, createdProfile?.type === "client");

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

  const toggleSaveSalon = useCallback(async (salon) => {
    const key = String(salon.id || salon.source_key || salon.name);
    const targetUserId = salon.id || Number(salon.source_key) || null;
    const previousSaved = savedSalonKeys.includes(key);
    const willSave = !previousSaved;

    setSavedSalonKeys((items) => (
      items.includes(key) ? items.filter((item) => item !== key) : [...items, key]
    ));

    if (!targetUserId) {
      // No real user id to persist against (e.g. a mock/demo row) — keep the
      // local-only toggle rather than failing silently.
      notify(willSave ? "سالن ذخیره شد." : "سالن از ذخیره‌ها حذف شد.");
      return;
    }

    try {
      const result = await toggleSave(targetUserId);
      if (!notifyFromResponse(notify, result, {
        failure: "ذخیره سالن انجام نشد؛ دوباره امتحان کن."
      })) {
        setSavedSalonKeys((items) => (
          previousSaved
            ? (items.includes(key) ? items : [...items, key])
            : items.filter((item) => item !== key)
        ));
        return;
      }
      notify(willSave ? "سالن ذخیره شد." : "سالن از ذخیره‌ها حذف شد.");
    } catch {
      setSavedSalonKeys((items) => (
        previousSaved
          ? (items.includes(key) ? items : [...items, key])
          : items.filter((item) => item !== key)
      ));
      notify("ذخیره سالن انجام نشد؛ دوباره امتحان کن.");
    }
  }, [savedSalonKeys, notify]);

  const shareSalonProfile = useCallback(async (nameHint) => {
    const name = nameHint || selectedSalon?.name || createdProfile?.data?.name || "سالن";
    const shareText = `پروفایل سالن «${name}» در frfro`;
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

  // `service`: a service name, or a service object — several services picked
  // together arrive as one bundle (shared/lib/serviceBundle) with summed duration.
  const openSalonClientBooking = useCallback((service = "") => {
    if (!selectedSalon) return;
    const picked = service && typeof service === "object" ? service : null;
    const serviceItems = getBookableSalonServiceItems(selectedSalon);
    const nextService = picked?.name || (typeof service === "string" ? service : "") || serviceItems[0]?.name || "";
    if (!nextService) {
      shellMsg("این سالن هنوز خدمتی برای رزرو ثبت نکرده است.");
      return;
    }
    setSalonClientTab("services");
    autoAdvanceDayRef.current = true;
    setSalonClientBooking((current) => ({
      open: true,
      service: nextService,
      bundle: picked?.items ? picked : null,
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
    if (patch && Object.prototype.hasOwnProperty.call(patch, "day")) autoAdvanceDayRef.current = false;
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
        client: salonClientBooking.client || createdProfile?.data?.name || "مشتری frfro",
        phone: salonClientBooking.phone || createdProfile?.data?.phone || "",
        service: salonClientBooking.service,
        staff: "",
        bookingDate: salonClientBooking.day,
        time: salonClientBooking.time,
        durationMinutes,
        // Several services: sent one by one, so the salon can give each its own artist.
        parts: salonClientBooking.bundle?.name === salonClientBooking.service
          ? salonClientBooking.bundle.items.map((item) => ({ service: item.name, duration: item.duration || "" }))
          : undefined,
        status: "درخواست"
      });
      if (!ok) {
        if (status === 409) {
          // Someone else took the slot between loading the list and tapping submit: drop it from
          // the grid so the client picks another instead of retrying the same dead time.
          setSalonClientUnavailableSlots((slots) => [
            ...slots,
            { booking_date: salonClientBooking.day, time: salonClientBooking.time, duration_minutes: durationMinutes }
          ]);
          shellMsg("این ساعت همین الان رزرو شد؛ ساعت دیگری انتخاب کن.");
        } else {
          shellMsg(payload?.error || "این زمان قابل رزرو نیست.");
        }
        return { ok: false, status, payload };
      }
      playSound("submit");
      if (String(salonUserId) === String(createdProfile?.id) && typeof onOwnerBookingsSync === "function") {
        onOwnerBookingsSync(payload?.data?.bookings || []);
      }
      const linkedArtistIds = payload?.data?.linkedArtistIds?.length
        ? payload.data.linkedArtistIds
        : [payload?.data?.linkedArtistId].filter(Boolean);
      if (typeof onLinkedArtistBooked === "function") {
        for (const linkedArtistId of linkedArtistIds) {
          try {
            await onLinkedArtistBooked(linkedArtistId);
          } catch {
            // artist refresh is best-effort; salon booking already succeeded
          }
        }
      }
      if (payload?.data?.booking) {
        const createdBooking = payload.data.booking;
        setSalonClientUnavailableSlots((slots) => [
          ...slots,
          {
            booking_date: createdBooking.booking_date,
            time: createdBooking.time,
            duration_minutes: createdBooking.duration_minutes || durationMinutes
          }
        ]);
        setClientBookingList((items) => [
          {
            ...createdBooking,
            salonName: selectedSalon.name,
            salonArea: selectedSalon.area,
            salonPhone: selectedSalon.phone,
            salonAvatar: selectedSalon.avatar,
            service: salonClientBooking.service,
            booking_date: createdBooking.booking_date || salonClientBooking.day,
            time: createdBooking.time || salonClientBooking.time,
            status: createdBooking.status || "درخواست"
          },
          ...items
        ]);
      }
      setSalonClientBooking((current) => ({ ...current, open: false }));
      // Deliberately says "awaiting confirmation", not "ثبت شد" (done/booked) —
      // the real status right after this call is "درخواست" (pending), and the
      // salon has up to an hour to respond (bookingExpirySweep.js). The old
      // "successfully registered" wording read as a done deal and gave no hint
      // a clock had started, which is exactly the "does the client understand
      // they're waiting" gap this line exists to close.
      shellMsg("درخواست رزرو ثبت شد؛ در انتظار تایید سالن.");
      notify(`رزرو ${salonClientBooking.service} برای ${salonClientBooking.day} ساعت ${salonClientBooking.time} ثبت شد و در انتظار تایید سالن است.`);
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
    cancelClientBooking,
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
