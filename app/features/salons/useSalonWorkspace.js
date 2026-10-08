"use client";

import { usePolling } from "../../shared/lib/usePolling";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSalonBooking, getSalonBookings, getSalonCollabs, getSalonHours, getSalonInvites, getSalonPortfolio, getSalonServices, getSalonStaff, getSalons, updateSalonBooking } from "../../shared/api/salons";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { buildSalonStaffByName } from "../profile/ScheduleRow";
import { useSalonPortfolioActions } from "./useSalonPortfolioActions";
import { useSalonCatalogActions } from "./useSalonCatalogActions";
import { useSalonInviteActions } from "./useSalonInviteActions";

/**
 * Salon **owner** dashboard: bookings, reservation inbox, staff, artist invites/collabs,
 * services, portfolio, working hours.
 *
 * Ownership boundaries (do NOT pull these into this hook):
 * - Schedule triad (scheduleNow / scheduleViewDay / scheduleBookingMenu / scheduleBookingView)
 *   stays in HomeApp — shared with the artist-owner schedule UI. Use `onScheduleViewDay` to
 *   push a computed weekday back to HomeApp after a booking is created/approved, and call
 *   `patchSalonAppointment` from thin HomeApp wrappers (changeScheduleBookingTime/Staff,
 *   cancelScheduleBooking) that close the schedule menu themselves on success.
 * - The booking-create sheet pair (bookingSheetOpen, bookingSelectMenu) and
 *   the booking form defaults (bookingStaffName, bookingServiceName, bookingDate) stay in
 *   HomeApp. `onCloseBookingSheet` is reused wherever the original HomeApp code reset any of
 *   that pair (it is safe/idempotent to call even when only a subset actually changed).
 *   `onBookingDefaults` is only invoked from `refreshSalonSystemData`, mirroring the original
 *   `setBookingStaffName((current) => current || …)` fallback pattern — HomeApp should apply it
 *   with the same "keep current if already set" functional update. Other mutations that used to
 *   force-sync bookingStaffName (addSalonStaff, updateSalonCollabRequest, updateSalonStaff,
 *   removeSalonStaff) and bookingDate (updateSalonHour, updateSalonHoursPreset) no longer do so
 *   from here; HomeApp can instead keep those in sync reactively via a `useEffect` keyed on the
 *   returned `salonStaffList` / `salonHoursList`.
 * - Salon **client** directory (browse/follow/save/book as a client) lives in `useSalonDirectory`.
 *   This hook only reaches into that world through `onSalonDirectorySync` / `onSelectedSalonSync`
 *   (pass HomeApp's `setSalonDirectory` / `setSelectedSalon` directly — both accept either a
 *   value or a functional updater, matching every call site here).
 * - `onOwnerBookingsSync` (client self-booking their own salon) stays wired directly between
 *   `useSalonDirectory` and HomeApp; this hook is not involved.
 * - Other-session client → owner booking sync is poll-only (8s interval below); there is no
 *   push/notify path the way `notifyArtistBookingCreated` works for artists.
 * - When a salon booking resolves to a linked artist profile, the create endpoint returns
 *   `linkedArtistId`; `onLinkedArtistBooked(linkedArtistId)` should be wired to the artist
 *   workspace's `notifyArtistBookingCreated` so that artist's own dashboard refreshes too.
 * - The shared service composer (artistServiceCreateOpen/Mode/Draft, used by both artist and
 *   salon "add service" UI) stays in HomeApp; its salon branch should call
 *   `upsertSalonOwnerService` instead of hitting `/api/salon-services` directly.
 *
 * @param {{
 *   createdProfile?: { id?: number|string, type?: string, data?: Record<string, unknown> } | null,
 *   onNotice?: (msg: string) => void,
 *   onShellNotice?: (msg: string) => void,
 *   onPostsChanged?: () => Promise<void> | void,
 *   onScheduleViewDay?: (day: string) => void,
 *   onCloseBookingSheet?: () => void,
 *   onLinkedArtistBooked?: (linkedArtistId: number|string) => void,
 *   onArtistCollabOffersPatch?: (updater: (items: any[]) => any[]) => void,
 *   onSalonDirectorySync?: (salons: any[] | ((items: any[]) => any[])) => void,
 *   onSelectedSalonSync?: (updater: any | ((current: any) => any)) => void,
 *   onBookingDefaults?: (defaults: { staffName?: string, serviceName?: string, date?: string }) => void,
 * }} options
 */
export function useSalonWorkspace({
  createdProfile = null,
  onNotice,
  onShellNotice,
  onPostsChanged,
  onScheduleViewDay,
  onCloseBookingSheet,
  onLinkedArtistBooked,
  onArtistCollabOffersPatch,
  onSalonDirectorySync,
  onSelectedSalonSync,
  onBookingDefaults,
} = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const shellNotify = useCallback((message) => {
    if (typeof onShellNotice === "function" && message) onShellNotice(message);
    else notify(message);
  }, [onShellNotice, notify]);

  const syncSalonDirectory = useCallback((next) => {
    if (typeof onSalonDirectorySync === "function") onSalonDirectorySync(next);
  }, [onSalonDirectorySync]);

  const syncSelectedSalon = useCallback((next) => {
    if (typeof onSelectedSalonSync === "function") onSelectedSalonSync(next);
  }, [onSelectedSalonSync]);

  const pushBookingDefaults = useCallback((defaults) => {
    if (typeof onBookingDefaults === "function") onBookingDefaults(defaults);
  }, [onBookingDefaults]);

  const salonBookingsEpochRef = useRef(0);

  const [salonTool, setSalonTool] = useState("portfolio");
  const [salonWorkspace, setSalonWorkspace] = useState(null);
  const [salonHeroSheet, setSalonHeroSheet] = useState(null);
  const [salonToolSheetOpen, setSalonToolSheetOpen] = useState(false);
  const [settingsHoursOpen, setSettingsHoursOpen] = useState(false);
  const [salonAppointmentList, setSalonAppointmentList] = useState([]);
  const [salonCollabRequestList, setSalonCollabRequestList] = useState([]);
  const [salonArtistInviteList, setSalonArtistInviteList] = useState([]);
  const [salonStaffList, setSalonStaffList] = useState([]);
  const [salonServiceList, setSalonServiceList] = useState([]);
  const [salonPortfolioList, setSalonPortfolioList] = useState([]);
  const [salonHoursList, setSalonHoursList] = useState([]);
  const [selectedSalonHourDay, setSelectedSalonHourDay] = useState("");
  const [selectedStaffName, setSelectedStaffName] = useState("");
  const [selectedArtistProfile, setSelectedArtistProfile] = useState(null);
  const [selectedBookingClient, setSelectedBookingClient] = useState(null);
  const [artistInviteOpen, setArtistInviteOpen] = useState(false);
  const [nearbyArtists, setNearbyArtists] = useState([]);
  const [nearbyArtistsLoading, setNearbyArtistsLoading] = useState(false);
  const [artistInviteBusyId, setArtistInviteBusyId] = useState("");
  const [salonBookingSubmitting, setSalonBookingSubmitting] = useState(false);
  const salonBookingSubmittingRef = useRef(false);
  // Artist ticks on a service (see toggleSalonServiceArtist): latest wanted list, last server-accepted list, save queue.
  const serviceArtistDesiredRef = useRef(new Map());
  const serviceArtistConfirmedRef = useRef(new Map());
  const serviceArtistChainRef = useRef(new Map());
  // When the last queued save for a service was confirmed by the server (absent while a save is still pending).
  const serviceArtistSavedAtRef = useRef(new Map());
  const [scheduleBookingBusy, setScheduleBookingBusy] = useState(false);
  const scheduleBookingBusyRef = useRef(false);
  const [salonRequestBusyId, setSalonRequestBusyId] = useState("");
  const salonRequestBusyIdRef = useRef("");
  const [salonWorkspaceLoading, setSalonWorkspaceLoading] = useState(true);
  const [salonWorkDraft, setSalonWorkDraft] = useState(null);
  const [salonWorkTagMenuOpen, setSalonWorkTagMenuOpen] = useState(false);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [serviceArtistMenuId, setServiceArtistMenuId] = useState(null);

  const safeSalonStaffList = useMemo(
    () => (Array.isArray(salonStaffList) ? salonStaffList : []),
    [salonStaffList]
  );

  const salonStaffByName = useMemo(
    () => buildSalonStaffByName(safeSalonStaffList),
    [safeSalonStaffList]
  );

  const pendingSalonArtistInvites = useMemo(() => (
    salonArtistInviteList.filter((item) => item.status === "در انتظار تایید")
  ), [salonArtistInviteList]);

  const pendingSalonCollabRequests = useMemo(() => (
    salonCollabRequestList.filter((item) => item.status === "آماده ارسال")
  ), [salonCollabRequestList]);

  /**
   * Real pending salon-booking requests — derived straight from the real
   * `salon_bookings` rows already living in `salonAppointmentList` (via
   * refreshSalonSystemData / applySalonBookings / the 8s live poll below),
   * never from mock/fake data. A "request" is just any booking whose status
   * is still "درخواست" (client asked, salon hasn't responded yet). Mapped
   * into the field shape SalonScheduleDashboard already renders
   * (id/client/service/staff/note/time/day/date) so that presentational
   * component didn't need to change.
   */
  const reservationRequestList = useMemo(() => (
    salonAppointmentList
      .filter((booking) => booking.status === "درخواست")
      .map((booking) => ({
        id: booking.id,
        client: booking.client,
        service: booking.service,
        staff: booking.staff,
        note: "",
        time: booking.time,
        day: formatRelativeBookingDayLabel(booking.booking_date),
        date: booking.booking_date || "",
        createdAt: booking.created_at || ""
      }))
  ), [salonAppointmentList]);

  const salonUnreadNoticeCount = useMemo(() => (
    reservationRequestList.length + pendingSalonCollabRequests.length
  ), [reservationRequestList.length, pendingSalonCollabRequests.length]);

  const applySalonBookings = useCallback((bookings, { bump = false } = {}) => {
    if (bump) salonBookingsEpochRef.current += 1;
    if (!Array.isArray(bookings)) return;
    setSalonAppointmentList(bookings);
  }, []);

  const refreshSalonBookingsLive = useCallback(async (epoch = salonBookingsEpochRef.current) => {
    try {
      const { ok, data } = await getSalonBookings();
      if (!ok) return;
      if (epoch !== salonBookingsEpochRef.current) return;
      setSalonAppointmentList(data?.bookings || []);
    } catch {
      // keep current bookings
    }
  }, []);

  const refreshSalonSystemData = useCallback(async () => {
    const epoch = ++salonBookingsEpochRef.current;
    const startedAt = Date.now();
    try {
      // The public directory is the heaviest call and nothing in the owner's own
      // tools waits on it: start it now, but apply the owner data first and sync
      // the directory when it lands instead of blocking the whole refresh on it.
      const salonsPromise = getSalons().catch(() => ({ ok: false }));
      const [
        servicesRes,
        portfolioRes,
        bookingsRes,
        staffRes,
        hoursRes,
        collabsRes,
        invitesRes
      ] = await Promise.all([
        getSalonServices(),
        getSalonPortfolio(),
        getSalonBookings(),
        getSalonStaff(),
        getSalonHours(),
        getSalonCollabs(),
        getSalonInvites()
      ]);

      const nextStaff = Array.isArray(staffRes.data?.staff) ? staffRes.data.staff : [];
      const nextHours = hoursRes.data?.hours || [];

      // A service whose artist ticks are still being saved (or were saved after this refresh began) keeps
      // its local list: this refresh may have been fetched before the save landed and would otherwise flip
      // the ticks back. A refresh that began after the save was confirmed is trusted and ends the override.
      const overlayServiceArtists = (items) => (Array.isArray(items) ? items : []).map((item) => {
        const key = String(item.id);
        const wanted = serviceArtistDesiredRef.current.get(key);
        if (!wanted) return item;
        const savedAt = serviceArtistSavedAtRef.current.get(key);
        if (savedAt && startedAt > savedAt) return item;
        const members = nextStaff.filter((person) => wanted.includes(String(person.id)));
        return {
          ...item,
          staff_ids: wanted,
          staff_id: wanted[0] || null,
          staff_members: members,
          staff_names: members.map((person) => person.name).filter(Boolean).join("، "),
          staff_name: members[0]?.name || "",
          staff_role: members[0]?.role || ""
        };
      });
      const nextServices = overlayServiceArtists(servicesRes.data?.services);

      setSalonServiceList(nextServices);
      setSalonPortfolioList(portfolioRes.data?.portfolio || []);
      if (epoch === salonBookingsEpochRef.current) {
        setSalonAppointmentList(bookingsRes.data?.bookings || []);
      }
      setSalonStaffList(nextStaff);
      setSalonHoursList(nextHours);
      setSalonCollabRequestList(collabsRes.data?.collabs || []);
      setSalonArtistInviteList(invitesRes.data?.invites || []);
      setSelectedStaffName((current) => current || nextStaff[0]?.name || "");

      pushBookingDefaults({
        staffName: nextStaff[0]?.name || "",
        serviceName: nextServices[0]?.name || "",
        date: nextHours.find((hour) => hour.active)?.day || "امروز"
      });
      setSalonWorkspaceLoading(false);

      const salonsRes = await salonsPromise;
      if (!salonsRes.ok) return;
      const nextSalonDirectory = (salonsRes.data?.salons || []).map((salon) => (
        Array.isArray(salon.services) ? { ...salon, services: overlayServiceArtists(salon.services) } : salon
      ));
      syncSalonDirectory(nextSalonDirectory);
      syncSelectedSalon((current) => {
        if (!current) return current;
        return nextSalonDirectory.find((salon) => (
          String(salon.id || "") === String(current.id || "")
          || String(salon.source_key || "") === String(current.source_key || "")
          || salon.name === current.name
        )) || current;
      });
    } catch {
      // keep current salon workspace data
    } finally {
      setSalonWorkspaceLoading(false);
    }
  }, [pushBookingDefaults, syncSalonDirectory, syncSelectedSalon]);

  const refreshSalonCollabRequests = useCallback(async () => {
    if (createdProfile?.type !== "salon") return;
    try {
      const { ok, data } = await getSalonCollabs();
      if (ok) setSalonCollabRequestList(data?.collabs || []);
    } catch {
      // keep current collaboration inbox
    }
  }, [createdProfile?.type]);

  const pollSalonLive = async () => {
      const epoch = salonBookingsEpochRef.current;
      try {
        const [collabsRes, bookingsRes] = await Promise.all([getSalonCollabs(), getSalonBookings()]);
        if (collabsRes.ok) setSalonCollabRequestList(collabsRes.data?.collabs || []);
        if (bookingsRes.ok && epoch === salonBookingsEpochRef.current) {
          setSalonAppointmentList(bookingsRes.data?.bookings || []);
        }
      } catch {
        // keep current inbox / bookings
      }
    };
  usePolling(pollSalonLive, 20000, createdProfile?.type === "salon");

  useEffect(() => {
    const activeTool = salonWorkspace || (salonToolSheetOpen ? salonTool : null);
    if (!activeTool || createdProfile?.type !== "salon") return;
    if (activeTool === "portfolio") {
      setSalonWorkTagMenuOpen(false);
      setPortfolioSaving(false);
    }
    refreshSalonSystemData();
  }, [salonWorkspace, salonToolSheetOpen, salonTool, createdProfile?.type, refreshSalonSystemData]);

  const openSalonWorkspace = useCallback((requested) => {
    // The salon services manager lives under the "hours" key; accept the
    // friendlier "services" alias so a mismatch can never render a blank panel.
    const tool = requested === "services" ? "hours" : requested;
    setSalonToolSheetOpen(false);
    setSalonHeroSheet(null);
    setSalonTool(tool);
    setServiceArtistMenuId(null);
    setSalonWorkspace(tool);
    if (typeof onCloseBookingSheet === "function") onCloseBookingSheet();
  }, [onCloseBookingSheet]);

  const closeSalonWorkspace = useCallback(() => {
    setSalonWorkspace(null);
    setServiceArtistMenuId(null);
    if (typeof onCloseBookingSheet === "function") onCloseBookingSheet();
  }, [onCloseBookingSheet]);

  const closeSalonToolSheet = useCallback(() => {
    setSalonToolSheetOpen(false);
    if (typeof onCloseBookingSheet === "function") onCloseBookingSheet();
  }, [onCloseBookingSheet]);

  const addSalonAppointment = useCallback(async (event, { bookingDateForSlots = "امروز", selectedBookingStaff = "" } = {}) => {
    event.preventDefault();
    if (salonBookingSubmittingRef.current) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.service) {
      shellNotify("اول یک خدمت واقعی در منوی خدمات سالن ثبت کن.");
      return;
    }
    const bookingDate = data.booking_date || bookingDateForSlots;
    salonBookingSubmittingRef.current = true;
    setSalonBookingSubmitting(true);
    try {
      const { ok, payload } = await createSalonBooking({
        time: data.time || "۱۸:۳۰",
        booking_date: bookingDate,
        client: data.client || "مشتری جدید",
        phone: data.phone || "",
        service: data.service,
        staff: data.staff || selectedBookingStaff,
        status: "تازه"
      });
      if (!ok) {
        applySalonBookings(payload.data?.bookings, { bump: true });
        shellNotify(getApiErrorMessage(payload, "این زمان قابل رزرو نیست."));
        return;
      }
      salonBookingsEpochRef.current += 1;
      const nextBookings = Array.isArray(payload.data?.bookings) ? payload.data.bookings : null;
      if (nextBookings) {
        setSalonAppointmentList(nextBookings);
      } else if (payload.data?.booking) {
        setSalonAppointmentList((list) => (
          list.some((item) => String(item.id) === String(payload.data.booking.id)) ? list : [payload.data.booking, ...list]
        ));
      }
      if (typeof onScheduleViewDay === "function") {
        onScheduleViewDay(payload.data?.booking?.booking_date || bookingDate);
      }
      shellNotify(payload.data?.artistBooking
        ? "رزرو در سالن ثبت شد و برای آرتیست هم ارسال شد."
        : "رزرو در سالن ثبت شد؛ این پرسنل به پروفایل آرتیست وصل نیست.");
      notify("رزرو با موفقیت ثبت شد.");
      setSalonToolSheetOpen(false);
      if (payload.data?.linkedArtistId && typeof onLinkedArtistBooked === "function") {
        onLinkedArtistBooked(payload.data.linkedArtistId);
      }
      try {
        form.reset();
      } catch {
        // form may unmount with the sheet
      }
      if (typeof onCloseBookingSheet === "function") onCloseBookingSheet();
      await refreshSalonBookingsLive(salonBookingsEpochRef.current);
    } catch {
      shellNotify("ثبت رزرو انجام نشد؛ دوباره امتحان کن.");
    } finally {
      salonBookingSubmittingRef.current = false;
      setSalonBookingSubmitting(false);
    }
  }, [shellNotify, notify, onScheduleViewDay, onLinkedArtistBooked, onCloseBookingSheet, applySalonBookings, refreshSalonBookingsLive]);

  /**
   * Owner update/cancel for a single booking. Returns a boolean so HomeApp's thin wrappers
   * (changeScheduleBookingTime/Staff, cancelScheduleBooking) can close scheduleBookingMenu
   * themselves on success — the schedule menu is HomeApp-owned state.
   */
  const patchSalonAppointment = useCallback(async (booking, patch, notice) => {
    if (!booking?.id) {
      shellNotify("این رزرو قابل ویرایش نیست.");
      return false;
    }
    if (scheduleBookingBusyRef.current) return false;
    scheduleBookingBusyRef.current = true;
    setScheduleBookingBusy(true);
    try {
      const { ok, payload } = await updateSalonBooking({ id: booking.id, ...patch });
      if (!ok) {
        if (Array.isArray(payload.data?.bookings)) applySalonBookings(payload.data.bookings, { bump: true });
        shellNotify(getApiErrorMessage(payload, "به‌روزرسانی رزرو انجام نشد."));
        return false;
      }
      applySalonBookings(payload.data?.bookings || [], { bump: true });
      const notifyIds = Array.isArray(payload.data?.linkedArtistIds) && payload.data.linkedArtistIds.length
        ? payload.data.linkedArtistIds
        : (payload.data?.linkedArtistId ? [payload.data.linkedArtistId] : []);
      if (typeof onLinkedArtistBooked === "function") {
        for (const artistId of notifyIds) {
          onLinkedArtistBooked(artistId);
        }
      }
      if (notice) shellNotify(notice);
      return true;
    } catch {
      shellNotify("به‌روزرسانی رزرو انجام نشد؛ دوباره امتحان کن.");
      return false;
    } finally {
      scheduleBookingBusyRef.current = false;
      setScheduleBookingBusy(false);
    }
  }, [shellNotify, applySalonBookings, onLinkedArtistBooked]);

  /**
   * Confirms a REAL pending `salon_bookings` row (status "درخواست") in place
   * via PATCH /api/salon-bookings — the same route/repo function
   * (patchSalonBookingWithArtistSync) every other owner booking edit here
   * uses (see patchSalonAppointment above). This used to fabricate a brand
   * new booking from fake mock data instead of touching the real pending
   * row at all; that bug is why the salon's notification bell could show 0
   * while real "درخواست" bookings sat unresolved in the DB forever.
   */
  const approveReservationRequest = useCallback(async (requestId) => {
    if (salonRequestBusyIdRef.current) return;
    const busyKey = `reservation:${requestId}`;
    salonRequestBusyIdRef.current = busyKey;
    setSalonRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateSalonBooking({ id: requestId, status: "تایید شده" });
      if (!ok) {
        if (Array.isArray(payload.data?.bookings)) applySalonBookings(payload.data.bookings, { bump: true });
        shellNotify(getApiErrorMessage(payload, "تایید رزرو انجام نشد."));
        return;
      }
      applySalonBookings(payload.data?.bookings || [], { bump: true });
      if (typeof onScheduleViewDay === "function" && payload.data?.booking?.booking_date) {
        onScheduleViewDay(payload.data.booking.booking_date);
      }
      const notifyIds = Array.isArray(payload.data?.linkedArtistIds) && payload.data.linkedArtistIds.length
        ? payload.data.linkedArtistIds
        : (payload.data?.linkedArtistId ? [payload.data.linkedArtistId] : []);
      if (typeof onLinkedArtistBooked === "function") {
        for (const artistId of notifyIds) onLinkedArtistBooked(artistId);
      }
      shellNotify("درخواست رزرو تایید شد.");
      await refreshSalonBookingsLive(salonBookingsEpochRef.current);
    } catch {
      shellNotify("تایید رزرو ذخیره نشد؛ دوباره امتحان کن.");
    } finally {
      salonRequestBusyIdRef.current = "";
      setSalonRequestBusyId("");
    }
  }, [shellNotify, onScheduleViewDay, onLinkedArtistBooked, applySalonBookings, refreshSalonBookingsLive]);

  /**
   * Rejects a REAL pending `salon_bookings` row by cancelling it — the exact
   * same cancel path (`status: "لغو"`, `action: "cancel"`) used by the
   * schedule menu's owner-initiated cancel (see useScheduleBookingMenu.js /
   * patchSalonAppointment), not a second cancel mechanism. Used to only
   * drop a fake mock item from local state with no DB write at all.
   */
  const declineReservationRequest = useCallback(async (requestId) => {
    if (salonRequestBusyIdRef.current) return;
    const busyKey = `reservation:${requestId}`;
    salonRequestBusyIdRef.current = busyKey;
    setSalonRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateSalonBooking({ id: requestId, status: "لغو", action: "cancel" });
      if (!ok) {
        if (Array.isArray(payload.data?.bookings)) applySalonBookings(payload.data.bookings, { bump: true });
        shellNotify(getApiErrorMessage(payload, "رد درخواست رزرو انجام نشد."));
        return;
      }
      applySalonBookings(payload.data?.bookings || [], { bump: true });
      const notifyIds = Array.isArray(payload.data?.linkedArtistIds) && payload.data.linkedArtistIds.length
        ? payload.data.linkedArtistIds
        : (payload.data?.linkedArtistId ? [payload.data.linkedArtistId] : []);
      if (typeof onLinkedArtistBooked === "function") {
        for (const artistId of notifyIds) onLinkedArtistBooked(artistId);
      }
      shellNotify("درخواست رزرو رد شد.");
    } catch {
      shellNotify("رد درخواست رزرو انجام نشد؛ دوباره امتحان کن.");
    } finally {
      salonRequestBusyIdRef.current = "";
      setSalonRequestBusyId("");
    }
  }, [shellNotify, applySalonBookings, onLinkedArtistBooked]);
  const {
    updateSalonCollabRequest,
    openNearbyArtistInvite,
    inviteNearbyArtist,
    cancelSalonArtistInvite
  } = useSalonInviteActions({
    shellNotify,
    safeSalonStaffList,
    createdProfile,
    artistInviteBusyId,
    salonRequestBusyIdRef,
    setSalonRequestBusyId,
    setSalonCollabRequestList,
    setSalonStaffList,
    setSelectedStaffName,
    setArtistInviteOpen,
    setNearbyArtistsLoading,
    setSalonArtistInviteList,
    setNearbyArtists,
    setArtistInviteBusyId
  });

  const {
    updateSalonStaff,
    removeSalonStaff,
    updateSalonHour,
    updateSalonHoursPreset,
    copySalonHourToOpenDays,
    addSalonService,
    assignSalonServiceArtist,
    toggleSalonServiceArtist,
    deleteSalonService
  } = useSalonCatalogActions({
    safeSalonStaffList,
    shellNotify,
    createdProfile,
    onArtistCollabOffersPatch,
    salonHoursList,
    syncSalonDirectory,
    syncSelectedSalon,
    refreshSalonSystemData,
    salonServiceList,
    setSalonStaffList,
    setSelectedStaffName,
    setSalonHoursList,
    setSalonServiceList,
    serviceArtistConfirmedRef,
    serviceArtistDesiredRef,
    serviceArtistChainRef,
    serviceArtistSavedAtRef
  });

  const {
    resetPortfolioComposer,
    openPortfolioComposer,
    clearSalonWorkImage,
    addSalonPortfolio,
    deleteSalonPortfolio,
    deleteSalonPortfolioFromComposer,
    upsertSalonOwnerService
  } = useSalonPortfolioActions({
    salonServiceList,
    portfolioSaving,
    salonWorkDraft,
    salonPortfolioList,
    shellNotify,
    refreshSalonSystemData,
    onPostsChanged,
    syncSalonDirectory,
    setSalonWorkTagMenuOpen,
    setSalonWorkDraft,
    setPortfolioSaving,
    setSalonPortfolioList
  });


  const resetSalonWorkspace = useCallback(() => {
    salonBookingsEpochRef.current += 1;
    setSalonTool("portfolio");
    setSalonWorkspace(null);
    setSalonHeroSheet(null);
    setSalonToolSheetOpen(false);
    setSettingsHoursOpen(false);
    setSalonAppointmentList([]);
    setSalonCollabRequestList([]);
    setSalonArtistInviteList([]);
    setSalonStaffList([]);
    setSalonServiceList([]);
    setSalonPortfolioList([]);
    setSalonHoursList([]);
    setSalonWorkspaceLoading(true);
    setSelectedSalonHourDay("");
    setSelectedStaffName("");
    setSelectedArtistProfile(null);
    setSelectedBookingClient(null);
    setArtistInviteOpen(false);
    setNearbyArtists([]);
    setNearbyArtistsLoading(false);
    setArtistInviteBusyId("");
    setSalonWorkDraft(null);
    setSalonWorkTagMenuOpen(false);
    setPortfolioSaving(false);
    setServiceArtistMenuId(null);
  }, []);

  return {
    salonBookingsEpochRef,
    salonTool,
    setSalonTool,
    salonWorkspace,
    setSalonWorkspace,
    salonHeroSheet,
    setSalonHeroSheet,
    salonToolSheetOpen,
    setSalonToolSheetOpen,
    settingsHoursOpen,
    setSettingsHoursOpen,
    salonAppointmentList,
    setSalonAppointmentList,
    reservationRequestList,
    salonCollabRequestList,
    setSalonCollabRequestList,
    salonArtistInviteList,
    setSalonArtistInviteList,
    salonStaffList,
    setSalonStaffList,
    salonServiceList,
    setSalonServiceList,
    salonPortfolioList,
    setSalonPortfolioList,
    salonHoursList,
    setSalonHoursList,
    selectedSalonHourDay,
    setSelectedSalonHourDay,
    selectedStaffName,
    setSelectedStaffName,
    selectedArtistProfile,
    setSelectedArtistProfile,
    selectedBookingClient,
    setSelectedBookingClient,
    artistInviteOpen,
    setArtistInviteOpen,
    nearbyArtists,
    setNearbyArtists,
    nearbyArtistsLoading,
    artistInviteBusyId,
    setArtistInviteBusyId,
    salonBookingSubmitting,
    scheduleBookingBusy,
    salonRequestBusyId,
    salonWorkspaceLoading,
    salonWorkDraft,
    setSalonWorkDraft,
    salonWorkTagMenuOpen,
    setSalonWorkTagMenuOpen,
    portfolioSaving,
    serviceArtistMenuId,
    setServiceArtistMenuId,
    safeSalonStaffList,
    salonStaffByName,
    pendingSalonArtistInvites,
    pendingSalonCollabRequests,
    salonUnreadNoticeCount,
    applySalonBookings,
    refreshSalonBookingsLive,
    refreshSalonSystemData,
    refreshSalonCollabRequests,
    openSalonWorkspace,
    closeSalonWorkspace,
    closeSalonToolSheet,
    addSalonAppointment,
    patchSalonAppointment,
    approveReservationRequest,
    declineReservationRequest,
    updateSalonCollabRequest,
    openNearbyArtistInvite,
    inviteNearbyArtist,
    cancelSalonArtistInvite,
    updateSalonStaff,
    removeSalonStaff,
    updateSalonHour,
    updateSalonHoursPreset,
    copySalonHourToOpenDays,
    addSalonService,
    assignSalonServiceArtist,
    toggleSalonServiceArtist,
    deleteSalonService,
    resetPortfolioComposer,
    openPortfolioComposer,
    clearSalonWorkImage,
    addSalonPortfolio,
    deleteSalonPortfolio,
    deleteSalonPortfolioFromComposer,
    upsertSalonOwnerService,
    resetSalonWorkspace
  };
}
