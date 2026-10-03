"use client";

import { usePolling } from "../../shared/lib/usePolling";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getArtists } from "../../shared/api/artists";
import {
  createSalonBooking,
  createSalonInvite,
  createSalonPortfolio,
  createSalonService as createSalonServiceApi,
  deleteSalonInvite,
  deleteSalonPortfolio as deleteSalonPortfolioApi,
  deleteSalonService as deleteSalonServiceApi,
  deleteSalonStaff,
  getSalonBookings,
  getSalonCollabs,
  getSalonHours,
  getSalonInvites,
  getSalonPortfolio,
  getSalonServices,
  getSalonStaff,
  getSalons,
  updateSalonBooking,
  updateSalonCollabs,
  updateSalonHours,
  updateSalonPortfolio,
  updateSalonService as updateSalonServiceApi,
  updateSalonStaff as updateSalonStaffApi
} from "../../shared/api/salons";
import { getApiErrorMessage, notifyFromResponse } from "../../shared/lib/apiNotify";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { buildSalonStaffByName } from "../profile/ScheduleRow";

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
 *   onExploreRefresh?: () => Promise<void> | void,
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
  onExploreRefresh,
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

      const nextServices = servicesRes.data?.services || [];
      const nextStaff = Array.isArray(staffRes.data?.staff) ? staffRes.data.staff : [];
      const nextHours = hoursRes.data?.hours || [];

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
      const nextSalonDirectory = salonsRes.data?.salons || [];
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
  usePolling(pollSalonLive, 10000, createdProfile?.type === "salon");

  useEffect(() => {
    const activeTool = salonWorkspace || (salonToolSheetOpen ? salonTool : null);
    if (!activeTool || createdProfile?.type !== "salon") return;
    if (activeTool === "portfolio") {
      setSalonWorkTagMenuOpen(false);
      setPortfolioSaving(false);
    }
    refreshSalonSystemData();
  }, [salonWorkspace, salonToolSheetOpen, salonTool, createdProfile?.type, refreshSalonSystemData]);

  const openSalonWorkspace = useCallback((tool) => {
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

  const updateSalonCollabRequest = useCallback(async (id, status) => {
    if (!id || salonRequestBusyIdRef.current) return;
    const busyKey = `collab:${id}`;
    salonRequestBusyIdRef.current = busyKey;
    setSalonRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateSalonCollabs({ id, status });
      if (!ok) {
        shellNotify(getApiErrorMessage(payload, "به‌روزرسانی پیشنهاد همکاری انجام نشد."));
        return;
      }
      setSalonCollabRequestList(payload.data?.collabs || []);
      if (Array.isArray(payload.data?.staff)) {
        setSalonStaffList(payload.data.staff);
        setSelectedStaffName((current) => current || payload.data.staff[0]?.name || "");
      }
      shellNotify(status === "تایید شد"
        ? (payload.data?.staffCreated ? "پیشنهاد تایید شد و آرتیست به پرسنل اضافه شد." : "پیشنهاد تایید شد؛ این آرتیست قبلا در پرسنل بود.")
        : "پیشنهاد همکاری رد شد.");
    } catch {
      shellNotify("به‌روزرسانی پیشنهاد همکاری انجام نشد.");
    } finally {
      salonRequestBusyIdRef.current = "";
      setSalonRequestBusyId("");
    }
  }, [shellNotify]);

  const openNearbyArtistInvite = useCallback(async () => {
    setArtistInviteOpen(true);
    setNearbyArtistsLoading(true);
    try {
      const [artistsRes, invitesRes] = await Promise.all([getArtists(), getSalonInvites()]);
      const invites = Array.isArray(invitesRes.data?.invites) ? invitesRes.data.invites : [];
      setSalonArtistInviteList(invites);
      const artists = Array.isArray(artistsRes.data?.artists) ? artistsRes.data.artists : [];
      const staffIds = new Set(
        safeSalonStaffList
          .map((person) => Number(person.artist_user_id || person.artistUserId || 0))
          .filter(Boolean)
      );
      const pendingInviteIds = new Set(
        invites
          .filter((item) => item.status === "در انتظار تایید")
          .map((item) => Number(item.artistId || 0))
          .filter(Boolean)
      );
      const staffNames = new Set(
        safeSalonStaffList
          .map((person) => String(person.artist_name || person.name || "").trim())
          .filter(Boolean)
      );
      const salonArea = String(createdProfile?.data?.area || "").trim();
      const filtered = artists
        .filter((artist) => {
          const id = Number(artist.id || 0);
          const name = String(artist.name || "").trim();
          if (id && staffIds.has(id)) return false;
          if (id && pendingInviteIds.has(id)) return false;
          if (name && staffNames.has(name)) return false;
          // An artist with no bio/specialty set hasn't filled in anything
          // a salon could actually invite them to collaborate on yet.
          if (!artist.bio || !artist.service) return false;
          return true;
        })
        .map((artist) => {
          const area = String(artist.area || "").trim();
          const sameArea = Boolean(salonArea && area && (area.includes(salonArea) || salonArea.includes(area)));
          return { ...artist, isNearby: sameArea };
        })
        .sort((a, b) => Number(b.isNearby) - Number(a.isNearby) || String(a.name || "").localeCompare(String(b.name || ""), "fa"));
      setNearbyArtists(filtered);
    } catch {
      setNearbyArtists([]);
      shellNotify("لیست آرتیست‌ها دریافت نشد؛ دوباره امتحان کن.");
    } finally {
      setNearbyArtistsLoading(false);
    }
  }, [safeSalonStaffList, createdProfile?.data?.area, shellNotify]);

  const inviteNearbyArtist = useCallback(async (artist, terms = {}) => {
    if (!artist?.id || artistInviteBusyId) return;
    setArtistInviteBusyId(String(artist.id));
    try {
      const { ok, payload } = await createSalonInvite({
        artist_user_id: artist.id,
        role: artist.service || "آرتیست",
        bio: artist.bio || artist.area || "دعوت‌شده از آرتیست‌های نزدیک",
        access_level: "همکار",
        days: terms.days || "",
        from: terms.from || "",
        to: terms.to || "",
        share: terms.share || "",
        capacity: terms.capacity || ""
      });
      if (!ok) {
        shellNotify(payload.error || "دعوت آرتیست انجام نشد.");
        return;
      }
      setSalonArtistInviteList(Array.isArray(payload.data?.invites) ? payload.data.invites : []);
      setNearbyArtists((current) => current.filter((item) => Number(item.id) !== Number(artist.id)));
      shellNotify(`دعوت برای «${artist.name || "آرتیست"}» ارسال شد؛ تا تایید آرتیست نهایی نیست.`);
    } catch {
      shellNotify("دعوت آرتیست انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setArtistInviteBusyId("");
    }
  }, [artistInviteBusyId, shellNotify]);

  const cancelSalonArtistInvite = useCallback(async (inviteId) => {
    try {
      const { ok, payload } = await deleteSalonInvite(inviteId);
      if (!ok) {
        shellNotify(payload.error || "لغو دعوت انجام نشد.");
        return;
      }
      setSalonArtistInviteList(Array.isArray(payload.data?.invites) ? payload.data.invites : []);
      shellNotify("دعوت لغو شد.");
    } catch {
      shellNotify("لغو دعوت انجام نشد؛ دوباره امتحان کن.");
    }
  }, [shellNotify]);

  const updateSalonStaff = useCallback(async (name, patch, notice) => {
    const person = safeSalonStaffList.find((item) => item.name === name);
    if (!person) return;
    try {
      const result = await updateSalonStaffApi({ ...person, ...patch });
      if (!notifyFromResponse(shellNotify, result, { failure: "به‌روزرسانی پرسنل انجام نشد؛ دوباره امتحان کن." })) {
        return;
      }
      const nextStaff = Array.isArray(result.payload.data?.staff) ? result.payload.data.staff : [];
      setSalonStaffList(nextStaff);
      setSelectedStaffName((current) => patch.name || current || nextStaff[0]?.name || "");
      if (notice) shellNotify(notice);
    } catch {
      shellNotify("به‌روزرسانی پرسنل انجام نشد؛ دوباره امتحان کن.");
    }
  }, [safeSalonStaffList, shellNotify]);

  const removeSalonStaff = useCallback(async (name) => {
    const person = safeSalonStaffList.find((item) => item.name === name);
    if (!person?.id) return;
    if (typeof window !== "undefined" && !window.confirm(`«${person.name}» از پرسنل حذف شود؟ این کار قابل بازگشت نیست.`)) {
      return;
    }
    try {
      const { ok, payload } = await deleteSalonStaff(person.id);
      if (!ok) {
        shellNotify(payload.error || "حذف پرسنل انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      const nextStaff = Array.isArray(payload.data?.staff) ? payload.data.staff : [];
      setSalonStaffList(nextStaff);
      setSelectedStaffName(nextStaff[0]?.name || "");
      if (payload.data?.artistNotified) {
        if (typeof onArtistCollabOffersPatch === "function") {
          onArtistCollabOffersPatch((items) => items.map((offer) => (
            Number(offer.salonId) === Number(createdProfile?.id)
            && Number(offer.artistId || 0) === Number(payload.data?.artistUserId || person.artist_user_id || 0)
              ? { ...offer, status: "پایان یافت" }
              : offer
          )));
        }
        shellNotify(`همکاری با «${name}» پایان یافت و در پروفایل آرتیست اطلاع داده شد.`);
      } else {
        shellNotify(`همکاری با «${name}» پایان یافت و از پرسنل حذف شد.`);
      }
    } catch {
      shellNotify("حذف پرسنل انجام نشد؛ دوباره امتحان کن.");
    }
  }, [safeSalonStaffList, createdProfile?.id, onArtistCollabOffersPatch, shellNotify]);

  const updateSalonHour = useCallback(async (hour, patch) => {
    const nextHour = { ...hour, ...patch };
    try {
      const result = await updateSalonHours(nextHour);
      if (!notifyFromResponse(shellNotify, result, { failure: "به‌روزرسانی تقویم سالن انجام نشد؛ دوباره امتحان کن." })) {
        return;
      }
      setSalonHoursList(result.payload.data?.hours || []);
      shellNotify(`تقویم ${nextHour.day} در دیتابیس سالن ذخیره شد.`);
    } catch {
      shellNotify("به‌روزرسانی تقویم سالن انجام نشد؛ دوباره امتحان کن.");
    }
  }, [shellNotify]);

  const updateSalonHoursPreset = useCallback(async (preset) => {
    const weekendDays = new Set(["پنجشنبه", "جمعه"]);
    const nextHours = salonHoursList.map((hour) => {
      const isWeekend = weekendDays.has(hour.day);
      if (preset === "standard") {
        return { ...hour, open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: !isWeekend };
      }
      if (preset === "extended") {
        return { ...hour, open_time: "۱۰:۰۰", close_time: "۲۲:۰۰", capacity: 12, active: true };
      }
      return { ...hour, open_time: "۱۲:۰۰", close_time: "۱۸:۰۰", capacity: 5, active: isWeekend };
    });
    try {
      const results = await Promise.all(nextHours.map((hour) => updateSalonHours(hour)));
      const failed = results.find((item) => !item.ok);
      if (failed) {
        shellNotify(getApiErrorMessage(failed.payload, "ذخیره گزینه کلی ساعت کاری انجام نشد؛ دوباره امتحان کن."));
        return;
      }
      const latestHours = results[results.length - 1]?.payload?.data?.hours || nextHours;
      setSalonHoursList(latestHours);
      shellNotify("گزینه کلی ساعت کاری روی تقویم سالن اعمال شد.");
    } catch {
      shellNotify("ذخیره گزینه کلی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
    }
  }, [salonHoursList, shellNotify]);

  /**
   * Copies one day's open/close time + capacity onto every other open day,
   * in one batch — the tedious part of the hours editor was setting the
   * same start/end time on each day one at a time; this is the "apply to
   * the rest of the week" shortcut for that. Closed days are left alone.
   */
  const copySalonHourToOpenDays = useCallback(async (sourceHour) => {
    const targets = salonHoursList.filter((hour) => hour.active);
    try {
      // Sequential on purpose (not Promise.all): several concurrent
      // authenticated PATCHes racing the session-touch poll (GET
      // /api/artist/me-equivalent presence heartbeat) could land out of
      // order and make the client-side hours list flicker/reset mid-update.
      let latestHours = salonHoursList;
      for (const hour of targets) {
        const nextHour = { ...hour, open_time: sourceHour.open_time, close_time: sourceHour.close_time, capacity: sourceHour.capacity };
        const result = await updateSalonHours(nextHour);
        if (!result.ok) {
          shellNotify(getApiErrorMessage(result.payload, "اعمال ساعت به بقیه روزها انجام نشد؛ دوباره امتحان کن."));
          return;
        }
        latestHours = result.payload.data?.hours || latestHours;
      }
      setSalonHoursList(latestHours);
      shellNotify("ساعت روی بقیه روزهای باز اعمال شد.");
    } catch {
      shellNotify("اعمال ساعت به بقیه روزها انجام نشد؛ دوباره امتحان کن.");
    }
  }, [salonHoursList, shellNotify]);

  /** Dedicated salon "add service" form (name/price/duration only, no hint/tone). */
  const addSalonService = useCallback(async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const { ok, payload } = await createSalonServiceApi({
        name: data.name || "خدمت جدید",
        price: data.price || "",
        duration: data.duration || ""
      });
      if (!ok) {
        shellNotify(payload.error || "ذخیره خدمت انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      const savedService = payload.data?.service;
      if (savedService?.name) {
        setSalonServiceList((items) => (
          items.some((item) => String(item.id) === String(savedService.id)) ? items : [...items, savedService]
        ));
        const ownSalonKey = String(createdProfile?.id || createdProfile?.data?.name || "");
        syncSalonDirectory((items) => items.map((salon) => {
          const isOwnSalon = String(salon.id || salon.source_key || salon.name) === ownSalonKey;
          if (!isOwnSalon) return salon;
          const services = Array.isArray(salon.services) ? salon.services : [];
          return services.some((service) => String(service.id) === String(savedService.id))
            ? salon
            : { ...salon, services: [...services, savedService] };
        }));
        syncSelectedSalon((current) => {
          if (!current) return current;
          const isOwnSalon = String(current.id || current.source_key || current.name) === ownSalonKey;
          if (!isOwnSalon) return current;
          const services = Array.isArray(current.services) ? current.services : [];
          return services.some((service) => String(service.id) === String(savedService.id))
            ? current
            : { ...current, services: [...services, savedService] };
        });
      }
      await refreshSalonSystemData();
      shellNotify("خدمت جدید در دیتابیس سالن ذخیره شد.");
      event.currentTarget.reset();
    } catch {
      shellNotify("ذخیره خدمت انجام نشد؛ دوباره امتحان کن.");
    }
  }, [createdProfile?.id, createdProfile?.data?.name, syncSalonDirectory, syncSelectedSalon, refreshSalonSystemData, shellNotify]);

  const assignSalonServiceArtist = useCallback(async (service, staffId) => {
    if (!service?.id) return;
    try {
      const { ok, payload } = await updateSalonServiceApi({
        id: service.id,
        name: service.name,
        price: service.price,
        duration: service.duration,
        staff_id: staffId,
        staff_ids: staffId ? [String(staffId)] : []
      });
      if (!ok) {
        shellNotify(payload.error || "انتخاب آرتیست انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      const saved = payload.data?.service;
      if (saved) {
        const selectedPeople = staffId ? safeSalonStaffList.filter((person) => String(person.id) === String(staffId)) : [];
        const nextService = {
          ...saved,
          staff_id: staffId || null,
          staff_ids: selectedPeople.map((person) => String(person.id)),
          staff_members: selectedPeople,
          staff_names: selectedPeople.map((person) => person.name).filter(Boolean).join("، ")
        };
        setSalonServiceList((items) => items.map((item) => (
          String(item.id) === String(saved.id) ? { ...item, ...nextService } : item
        )));
        syncSalonDirectory((items) => items.map((salon) => {
          const services = Array.isArray(salon.services) ? salon.services : [];
          const hasService = services.some((item) => String(item.id) === String(saved.id));
          if (!hasService) return salon;
          return {
            ...salon,
            services: services.map((item) => String(item.id) === String(saved.id) ? { ...item, ...nextService } : item),
            staff: Array.isArray(salon.staff) && salon.staff.length ? salon.staff : safeSalonStaffList
          };
        }));
        syncSelectedSalon((current) => {
          if (!current) return current;
          const services = Array.isArray(current.services) ? current.services : [];
          const hasService = services.some((item) => String(item.id) === String(saved.id));
          if (!hasService) return current;
          return {
            ...current,
            services: services.map((item) => String(item.id) === String(saved.id) ? { ...item, ...nextService } : item),
            staff: Array.isArray(current.staff) && current.staff.length ? current.staff : safeSalonStaffList
          };
        });
      } else {
        await refreshSalonSystemData();
      }
      setServiceArtistMenuId(null);
      const artistName = saved?.staff_name || safeSalonStaffList.find((person) => String(person.id) === String(staffId))?.name;
      shellNotify(artistName ? `آرتیست «${artistName}» برای «${service.name}» انتخاب شد.` : `آرتیست خدمت «${service.name}» برداشته شد.`);
    } catch {
      shellNotify("انتخاب آرتیست انجام نشد؛ دوباره امتحان کن.");
    }
  }, [safeSalonStaffList, syncSalonDirectory, syncSelectedSalon, refreshSalonSystemData, shellNotify]);

  const toggleSalonServiceArtist = useCallback(async (service, staffId) => {
    if (!service?.id) return;
    const currentIds = Array.isArray(service.staff_ids)
      ? service.staff_ids.map(String)
      : service.staff_id
        ? [String(service.staff_id)]
        : [];
    const id = String(staffId);
    const nextIds = currentIds.includes(id)
      ? currentIds.filter((item) => item !== id)
      : [...currentIds, id];
    const primaryStaffId = nextIds[0] || null;

    try {
      const { ok, payload } = await updateSalonServiceApi({
        id: service.id,
        name: service.name,
        price: service.price,
        duration: service.duration,
        staff_id: primaryStaffId,
        staff_ids: nextIds
      });
      if (!ok) {
        shellNotify(payload.error || "انتخاب آرتیست انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      const selectedPeople = safeSalonStaffList.filter((person) => nextIds.includes(String(person.id)));
      const saved = payload.data?.service;
      const nextService = {
        ...(saved || service),
        staff_id: primaryStaffId,
        staff_ids: nextIds,
        staff_members: selectedPeople,
        staff_names: selectedPeople.map((person) => person.name).filter(Boolean).join("، "),
        staff_name: selectedPeople[0]?.name || "",
        staff_role: selectedPeople[0]?.role || ""
      };
      setSalonServiceList((items) => items.map((item) => (
        String(item.id) === String(service.id) ? { ...item, ...nextService } : item
      )));
      syncSalonDirectory((items) => items.map((salon) => {
        const services = Array.isArray(salon.services) ? salon.services : [];
        const hasService = services.some((item) => String(item.id) === String(service.id));
        if (!hasService) return salon;
        return {
          ...salon,
          services: services.map((item) => String(item.id) === String(service.id) ? { ...item, ...nextService } : item),
          staff: Array.isArray(salon.staff) && salon.staff.length ? salon.staff : safeSalonStaffList
        };
      }));
      syncSelectedSalon((current) => {
        if (!current) return current;
        const services = Array.isArray(current.services) ? current.services : [];
        const hasService = services.some((item) => String(item.id) === String(service.id));
        if (!hasService) return current;
        return {
          ...current,
          services: services.map((item) => String(item.id) === String(service.id) ? { ...item, ...nextService } : item),
          staff: Array.isArray(current.staff) && current.staff.length ? current.staff : safeSalonStaffList
        };
      });
      shellNotify(nextIds.length
        ? `${nextIds.length} آرتیست برای «${service.name}» انتخاب شد.`
        : `آرتیست‌های «${service.name}» برداشته شدند.`);
    } catch {
      shellNotify("انتخاب آرتیست انجام نشد؛ دوباره امتحان کن.");
    }
  }, [safeSalonStaffList, syncSalonDirectory, syncSelectedSalon, shellNotify]);

  const deleteSalonService = useCallback(async (id) => {
    const target = salonServiceList.find((item) => item.id === id);
    const confirmed = typeof window === "undefined"
      || window.confirm(target ? `«${target.name}» حذف شود؟ این کار قابل بازگشت نیست.` : "این خدمت حذف شود؟ این کار قابل بازگشت نیست.");
    if (!confirmed) return;
    try {
      const result = await deleteSalonServiceApi(id);
      if (!notifyFromResponse(shellNotify, result, { failure: "حذف خدمت انجام نشد؛ دوباره امتحان کن." })) {
        return;
      }
      if (Array.isArray(result.payload.data?.services)) {
        setSalonServiceList(result.payload.data.services);
      }
      await refreshSalonSystemData();
      shellNotify("خدمت از دیتابیس حذف شد.");
    } catch {
      shellNotify("حذف خدمت انجام نشد؛ دوباره امتحان کن.");
    }
  }, [salonServiceList, refreshSalonSystemData, shellNotify]);

  const resetPortfolioComposer = useCallback(() => {
    setSalonWorkTagMenuOpen(false);
    setSalonWorkDraft(null);
    setPortfolioSaving(false);
  }, []);

  const openPortfolioComposer = useCallback((item = null) => {
    setSalonWorkTagMenuOpen(false);
    if (item) {
      setSalonWorkDraft({
        id: item.id,
        title: item.title || "",
        tag: item.tag || "",
        caption: item.caption || "",
        image: item.image || "",
        tile: item.tile || "tile1",
        inExplore: true,
        featured: true
      });
      return;
    }
    setSalonWorkDraft({
      id: "new",
      title: "",
      tag: salonServiceList[0]?.name || "",
      caption: "",
      image: "",
      tile: "tile1",
      inExplore: true,
      featured: true
    });
  }, [salonServiceList]);

  const clearSalonWorkImage = useCallback(() => {
    setSalonWorkDraft((prev) => (prev ? { ...prev, image: "" } : prev));
  }, []);

  const addSalonPortfolio = useCallback(async (event) => {
    event.preventDefault();
    if (portfolioSaving || !salonWorkDraft) return;
    const title = String(salonWorkDraft.title || "").trim();
    const tag = String(salonWorkDraft.tag || "").trim();
    const image = String(salonWorkDraft.image || "").trim();
    const caption = String(salonWorkDraft.caption || "").trim();
    const inExplore = salonWorkDraft.inExplore !== false;
    const featured = true;
    if (!image) {
      shellNotify("اول یک عکس برای پست انتخاب کن.");
      return;
    }
    if (!title) {
      shellNotify("عنوان پست را وارد کن.");
      return;
    }
    if (!tag) {
      shellNotify("دسته پست را از بین خدمات انتخاب کن.");
      return;
    }

    const isNew = String(salonWorkDraft.id).startsWith("new-") || salonWorkDraft.id === "new";
    setPortfolioSaving(true);
    try {
      if (!isNew) {
        const { ok, payload } = await updateSalonPortfolio({
          id: salonWorkDraft.id,
          title,
          tag,
          tile: salonWorkDraft.tile || "tile1",
          image,
          caption,
          inExplore,
          featured
        });
        if (!ok) {
          shellNotify(payload.error || "ویرایش پست انجام نشد؛ دوباره امتحان کن.");
          return;
        }
        await refreshSalonSystemData();
        if (typeof onExploreRefresh === "function") await onExploreRefresh();
        shellNotify(inExplore ? "پست به‌روزرسانی و در اکسپلور منتشر شد." : "پست سالن به‌روزرسانی شد.");
      } else {
        const nextIndex = salonPortfolioList.length % 4;
        const tiles = ["tile1", "tile3", "tile4", "tile8"];
        const { ok, payload } = await createSalonPortfolio({
          title,
          tile: tiles[nextIndex],
          tag,
          image,
          caption,
          inExplore,
          featured
        });
        if (!ok) {
          shellNotify(payload.error || "ذخیره نمونه‌کار انجام نشد؛ دوباره امتحان کن.");
          return;
        }
        await refreshSalonSystemData();
        if (typeof onExploreRefresh === "function") await onExploreRefresh();
        const { data } = await getSalons();
        syncSalonDirectory(data?.salons || []);
        shellNotify(inExplore ? "پست در اکسپلور منتشر شد." : "نمونه‌کار سالن ذخیره شد.");
      }
      resetPortfolioComposer();
    } catch {
      shellNotify(isNew ? "ذخیره نمونه‌کار انجام نشد؛ دوباره امتحان کن." : "ویرایش پست انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setPortfolioSaving(false);
    }
  }, [portfolioSaving, salonWorkDraft, salonPortfolioList.length, shellNotify, refreshSalonSystemData, onExploreRefresh, syncSalonDirectory, resetPortfolioComposer]);

  const deleteSalonPortfolio = useCallback(async (id) => {
    if (!id) return;
    if (typeof window !== "undefined" && !window.confirm("این پست حذف شود؟")) return;
    try {
      const { ok, payload } = await deleteSalonPortfolioApi(id);
      if (!ok) {
        shellNotify(payload.error || "حذف پست انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      await refreshSalonSystemData();
      if (typeof onExploreRefresh === "function") await onExploreRefresh();
      if (salonWorkDraft?.id === id) resetPortfolioComposer();
      shellNotify("پست سالن حذف شد.");
    } catch {
      shellNotify("حذف پست انجام نشد؛ دوباره امتحان کن.");
    }
  }, [shellNotify, refreshSalonSystemData, onExploreRefresh, salonWorkDraft, resetPortfolioComposer]);

  const deleteSalonPortfolioFromComposer = useCallback(async () => {
    if (!salonWorkDraft?.id) return;
    const isNew = String(salonWorkDraft.id).startsWith("new-") || salonWorkDraft.id === "new";
    if (isNew) {
      resetPortfolioComposer();
      return;
    }
    await deleteSalonPortfolio(salonWorkDraft.id);
  }, [salonWorkDraft, resetPortfolioComposer, deleteSalonPortfolio]);

  /** Shared service composer's salon branch (artistServiceCreateOpen/Mode/Draft stay in HomeApp). */
  const upsertSalonOwnerService = useCallback(async (body, { editingId } = {}) => {
    try {
      const { ok, payload } = editingId
        ? await updateSalonServiceApi({ id: editingId, ...body })
        : await createSalonServiceApi(body);
      if (!ok) {
        shellNotify(payload.error || (editingId ? "ویرایش خدمت انجام نشد." : "افزودن خدمت انجام نشد."));
        return false;
      }
      await refreshSalonSystemData();
      return true;
    } catch {
      shellNotify(editingId ? "ویرایش خدمت انجام نشد." : "افزودن خدمت انجام نشد.");
      return false;
    }
  }, [shellNotify, refreshSalonSystemData]);

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
