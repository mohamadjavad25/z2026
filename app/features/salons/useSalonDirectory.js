"use client";

import { playSound } from "../../shared/lib/sounds";
import { usePolling } from "../../shared/lib/usePolling";
import { useAppRefresh } from "../../shared/lib/appRefresh";
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
import { bundleServices } from "../../shared/lib/serviceBundle";
import { salonServiceCatalog } from "./constants";

const initialBooking = {
  open: false,
  service: "",
  bundle: null,
  client: "",
  phone: ""
};

export function getVisibleSalonServiceItems(salon) {
  if (salon?.services?.length) return salon.services.filter((service) => service?.name);
  return [];
}

export function getBookableSalonServiceItems(salon) {
  const visible = getVisibleSalonServiceItems(salon);
  return visible.length ? visible : salonServiceCatalog;
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
  onLinkedArtistBooked,
  onClientBooked
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

  /** The client accepts or declines a new time the salon offered for their booking. */
  const answerClientTimeOffer = useCallback(async (booking, accept) => {
    if (!booking?.id) return false;
    try {
      const { ok, payload } = await apiFetch(`/api/salon-bookings/${booking.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ accept })
      });
      if (!ok) {
        notify(payload?.error || "جواب ثبت نشد.");
        if (typeof refreshClientBookings === "function") refreshClientBookings();
        return false;
      }
      const updated = payload?.data?.booking || {};
      setClientBookingList((list) => list.map((item) => (
        item.id === booking.id && item.bookingSource !== "artist" ? { ...item, ...updated, service: item.service } : item
      )));
      notify(accept
        ? `نوبتت برای ساعت ${updated.time || booking.time} قطعی شد.`
        : "درخواست لغو شد. می‌توانی ساعت دیگری بگیری.");
      return true;
    } catch {
      notify("جواب ثبت نشد؛ دوباره امتحان کن.");
      return false;
    }
  }, [notify, refreshClientBookings]);

  const resetSalonClient = useCallback(() => {
    setSelectedSalon(null);
    setFollowedSalons([]);
    setSavedSalonKeys([]);
    setSalonClientTab("services");
    setSalonClientBooking(initialBooking);
    setClientBookingList([]);
  }, []);

  useEffect(() => {
    if (!selectedSalon) return;
    setSalonClientTab("services");
  }, [selectedSalon?.id, selectedSalon?.source_key]);

  // The salon's weekly hours, so the booking form can show the closed days as closed.
  useEffect(() => {
    if (!salonClientBooking.open || !selectedSalon) return undefined;
    const salonUserId = selectedSalon.id || selectedSalon.source_key;
    if (!salonUserId) return undefined;
    let cancelled = false;
    getSalonBookings(salonUserId)
      .then(({ data, payload }) => {
        if (cancelled) return;
        const hours = data?.hours || payload?.hours;
        if (Array.isArray(hours) && hours.length) {
          setSelectedSalon((current) => (
            current && String(current.id || current.source_key) === String(salonUserId)
              ? { ...current, hours }
              : current
          ));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [salonClientBooking.open, selectedSalon?.id, selectedSalon?.source_key]);

  // Fast while a request is waiting for an answer, slow otherwise (every poll is a function call).
  const hasWaitingBooking = clientBookingList.some((item) => item.status === "درخواست" || item.status === "تازه");
  usePolling(refreshClientBookings, hasWaitingBooking ? 8000 : 45000, createdProfile?.type === "client");
  useAppRefresh(refreshSalonDirectory);

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
    setSalonClientBooking((current) => ({
      open: true,
      service: nextService,
      bundle: picked?.items ? picked : null,
      client: current.client || createdProfile?.data?.name || "",
      phone: current.phone || createdProfile?.data?.phone || ""
    }));
  }, [selectedSalon, createdProfile, shellMsg]);

  const closeSalonClientBooking = useCallback(() => {
    setSalonClientBooking((current) => ({ ...current, open: false }));
  }, []);

  const clientVisitBusyRef = useRef(false);
  /**
   * The client's request from the booking form (VisitBooker): one service or several back to back.
   * Resolves { ok, status, payload } so the form can say what went wrong in place; on success the
   * client gets the «درخواستت رسید» receipt. Nothing here toasts a failure.
   */
  const submitSalonClientVisit = useCallback(async (body) => {
    const salonUserId = selectedSalon?.id || selectedSalon?.source_key;
    if (!salonUserId) return { ok: false, status: 0, payload: { error: "شناسه سالن برای ثبت رزرو پیدا نشد." } };
    if (clientVisitBusyRef.current) return { ok: false, status: 0, payload: { error: "ثبت قبلی هنوز تمام نشده." } };
    clientVisitBusyRef.current = true;
    try {
      const { ok, payload, status } = await createSalonBooking({ ...body, salonUserId, status: "درخواست" });
      if (!ok) return { ok: false, status, payload };
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
      // Every service on its own line, like an invoice (the booking row stores only joined text).
      const listed = getBookableSalonServiceItems(selectedSalon);
      const names = body.parts?.length ? body.parts.map((part) => part.service) : [body.service];
      const items = names
        .map((name) => listed.find((item) => String(item?.name || "") === name))
        .filter(Boolean);
      const price = items.length > 1 ? bundleServices(items)?.price : items[0]?.price;
      const created = payload?.data?.booking;
      let bookedRow = null;
      if (created) {
        bookedRow = {
          ...created,
          salonName: selectedSalon.name,
          salonArea: selectedSalon.area,
          salonPhone: selectedSalon.phone,
          salonAvatar: selectedSalon.avatar,
          service: created.service || body.service,
          booking_date: created.booking_date || body.bookingDate,
          time: created.time || body.time,
          status: created.status || "درخواست"
        };
        setClientBookingList((list) => [bookedRow, ...list]);
      }
      setSalonClientBooking((current) => ({ ...current, open: false }));
      // Says "awaiting confirmation", not "booked": the real status right now is "درخواست" and the
      // salon has up to an hour to answer (see bookingExpirySweep.js).
      if (bookedRow && typeof onClientBooked === "function") {
        onClientBooked(bookedRow, { price: price || "", items });
      } else {
        shellMsg("درخواست رزرو ثبت شد؛ در انتظار تایید سالن.");
        notify(`رزرو ${body.service} ساعت ${body.time} ثبت شد و در انتظار تایید سالن است.`);
      }
      return { ok: true, status, payload };
    } catch {
      return { ok: false, status: 0, payload: {} };
    } finally {
      clientVisitBusyRef.current = false;
    }
  }, [selectedSalon, createdProfile, onOwnerBookingsSync, onLinkedArtistBooked, onClientBooked, shellMsg, notify]);

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
    clientBookingList,
    setClientBookingList,
    savedSalonList,
    isFollowingSelectedSalon,
    isSavedSelectedSalon,
    refreshSalonDirectory,
    refreshClientBookings,
    cancelClientBooking,
    answerClientTimeOffer,
    resetSalonClient,
    toggleFollowSalon,
    toggleSaveSalon,
    shareSalonProfile,
    openSalonClientBooking,
    closeSalonClientBooking,
    submitSalonClientVisit,
    getVisibleSalonServiceItems
  };
}
