"use client";

import { usePolling } from "../../shared/lib/usePolling";
import { useAppRefresh } from "../../shared/lib/appRefresh";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSalonBooking, getSalonBookings, getSalonCollabs, getSalonHours, getSalonInvites, getSalonPortfolio, getSalonServices, getSalonStaff, getSalons, updateSalonBooking } from "../../shared/api/salons";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";
import { markNoShow, withdrawProposal } from "../../shared/api/providerExit";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { bookingWaitMinutes } from "../../shared/lib/bookingWindow";
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
 * - Whether the booking sheet is open (bookingSheetOpen) stays in HomeApp. `onCloseBookingSheet`
 *   is reused wherever the original HomeApp code closed it (safe to call when it is already closed).
 *   The sheet itself (VisitBooker) holds its own picks and reads the lists this hook returns.
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
  onSelectedSalonSync
} = {}) {
  // Callers pass fresh inline functions on every render. Read the latest ones through a ref so notify/sync/push
  // keep one identity for the life of the hook: refreshSalonSystemData depends on them, and the effect below
  // re-runs whenever it changes, which used to turn every render into another full reload of the workspace.
  const callbacksRef = useRef({});
  callbacksRef.current = { onNotice, onShellNotice, onSalonDirectorySync, onSelectedSalonSync };

  const notify = useCallback((message) => {
    const { onNotice: onNoticeNow } = callbacksRef.current;
    if (typeof onNoticeNow === "function" && message) onNoticeNow(message);
  }, []);

  const shellNotify = useCallback((message) => {
    const { onShellNotice: onShellNoticeNow } = callbacksRef.current;
    if (typeof onShellNoticeNow === "function" && message) onShellNoticeNow(message);
    else notify(message);
  }, [notify]);

  const syncSalonDirectory = useCallback((next) => {
    const { onSalonDirectorySync: onSalonDirectorySyncNow } = callbacksRef.current;
    if (typeof onSalonDirectorySyncNow === "function") onSalonDirectorySyncNow(next);
  }, []);

  const syncSelectedSalon = useCallback((next) => {
    const { onSelectedSalonSync: onSelectedSalonSyncNow } = callbacksRef.current;
    if (typeof onSelectedSalonSyncNow === "function") onSelectedSalonSyncNow(next);
  }, []);

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
  const [selectedStaffName, setSelectedStaffName] = useState("");
  const [selectedArtistProfile, setSelectedArtistProfile] = useState(null);
  const [selectedBookingClient, setSelectedBookingClient] = useState(null);
  const [artistInviteOpen, setArtistInviteOpen] = useState(false);
  const [nearbyArtists, setNearbyArtists] = useState([]);
  const [nearbyArtistsLoading, setNearbyArtistsLoading] = useState(false);
  const [artistInviteBusyId, setArtistInviteBusyId] = useState("");
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
        createdAt: booking.created_at || "",
        waitMinutes: bookingWaitMinutes(booking)
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

      // Signed out (cookie gone or expired): there is nothing to show and nothing to refresh. Applying the empty
      // results below would re-render and could retrigger this refresh, hammering the API with 401s.
      if ([servicesRes, portfolioRes, bookingsRes, staffRes, hoursRes, collabsRes, invitesRes].some((res) => res.status === 401)) return;

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
  }, [syncSalonDirectory, syncSelectedSalon]);

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
  useAppRefresh(refreshSalonSystemData, createdProfile?.type === "salon");

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

  /**
   * The salon's own booking from the booking form (VisitBooker): one service or several back to back,
   * with an artist per service when the salon named them. Resolves { ok, status, payload } so the form
   * can say what went wrong; nothing here toasts a failure (the form shows it where the person is looking).
   */
  const submitSalonVisit = useCallback(async (body) => {
    if (salonBookingSubmittingRef.current) return { ok: false, status: 0, payload: { error: "قبلیه هنوز تموم نشده؛ یه لحظه صبر کن." } };
    salonBookingSubmittingRef.current = true;
    try {
      const { ok, status, payload } = await createSalonBooking({ ...body, status: "تازه" });
      if (!ok) {
        applySalonBookings(payload?.data?.bookings, { bump: true });
        return { ok: false, status, payload };
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
        onScheduleViewDay(payload.data?.booking?.booking_date || body.bookingDate);
      }
      const linkedArtistIds = payload.data?.linkedArtistIds?.length
        ? payload.data.linkedArtistIds
        : [payload.data?.linkedArtistId].filter(Boolean);
      shellNotify(linkedArtistIds.length
        ? "نوبت ثبت شد و آرتیست هم خبردار شد."
        : "نوبت ثبت شد؛ این آرتیست حساب فرفرو نداره، خودت خبرش کن.");
      notify("نوبت ثبت شد!");
      setSalonToolSheetOpen(false);
      if (typeof onLinkedArtistBooked === "function") {
        for (const linkedArtistId of linkedArtistIds) {
          try {
            await onLinkedArtistBooked(linkedArtistId);
          } catch {
            // the artist's refresh is best effort; the salon booking is already in
          }
        }
      }
      if (typeof onCloseBookingSheet === "function") onCloseBookingSheet();
      void refreshSalonBookingsLive(salonBookingsEpochRef.current);
      return { ok: true, status, payload };
    } catch {
      return { ok: false, status: 0, payload: {} };
    } finally {
      salonBookingSubmittingRef.current = false;
    }
  }, [shellNotify, notify, onScheduleViewDay, onLinkedArtistBooked, onCloseBookingSheet, applySalonBookings, refreshSalonBookingsLive]);

  /**
   * Owner update/cancel for a single booking. Returns a boolean so HomeApp's thin wrappers
   * (changeScheduleBookingTime/Staff, cancelScheduleBooking) can close scheduleBookingMenu
   * themselves on success — the schedule menu is HomeApp-owned state.
   */
  const patchSalonAppointment = useCallback(async (booking, patch, notice) => {
    if (!booking?.id) {
      shellNotify("این نوبت رو دیگه نمی‌شه عوض کرد.");
      return false;
    }
    if (scheduleBookingBusyRef.current) return false;
    scheduleBookingBusyRef.current = true;
    setScheduleBookingBusy(true);
    try {
      // `withdrawProposal`: the salon takes back its «پیشنهاد ساعت دیگر» (DELETE /api/booking-proposals).
      // `noShow`: «نیومد» on a booking that has started, or taking it back (POST /api/booking-no-show).
      const { ok, payload } = patch?.withdrawProposal
        ? await withdrawProposal({ kind: "salon", id: booking.id })
        : typeof patch?.noShow === "boolean"
          ? await markNoShow({ kind: "salon", id: booking.id, noShow: patch.noShow })
          : await updateSalonBooking({ id: booking.id, ...patch });
      if (!ok) {
        if (Array.isArray(payload.data?.bookings)) applySalonBookings(payload.data.bookings, { bump: true });
        shellNotify(getApiErrorMessage(payload, "نوبت ذخیره نشد؛ دوباره بزن."));
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
      shellNotify("نوبت ذخیره نشد؛ دوباره بزن.");
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
        shellNotify(getApiErrorMessage(payload, "تأیید نشد؛ دوباره بزن."));
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
      shellNotify("تأیید شد؛ مشتری خبردار شد.");
      await refreshSalonBookingsLive(salonBookingsEpochRef.current);
    } catch {
      shellNotify("تأیید نشد؛ دوباره بزن.");
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
        shellNotify(getApiErrorMessage(payload, "رد نشد؛ دوباره بزن."));
        return;
      }
      applySalonBookings(payload.data?.bookings || [], { bump: true });
      const notifyIds = Array.isArray(payload.data?.linkedArtistIds) && payload.data.linkedArtistIds.length
        ? payload.data.linkedArtistIds
        : (payload.data?.linkedArtistId ? [payload.data.linkedArtistId] : []);
      if (typeof onLinkedArtistBooked === "function") {
        for (const artistId of notifyIds) onLinkedArtistBooked(artistId);
      }
      shellNotify("رد شد؛ مشتری خبردار شد.");
    } catch {
      shellNotify("رد نشد؛ دوباره بزن.");
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
    joinSalonTeamAsOwner,
    saveSalonHoursWeek,
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
    submitSalonVisit,
    patchSalonAppointment,
    approveReservationRequest,
    declineReservationRequest,
    updateSalonCollabRequest,
    openNearbyArtistInvite,
    inviteNearbyArtist,
    cancelSalonArtistInvite,
    updateSalonStaff,
    removeSalonStaff,
    joinSalonTeamAsOwner,
    saveSalonHoursWeek,
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
