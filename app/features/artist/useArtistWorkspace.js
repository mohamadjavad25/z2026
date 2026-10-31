"use client";

import { usePolling } from "../../shared/lib/usePolling";
import { useAppRefresh } from "../../shared/lib/appRefresh";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createArtistMe, deleteArtistMe, getArtistHours, getArtistMe, respondArtistInvite, getArtistTeams, leaveArtistTeam, updateArtistBooking, updateArtistMe } from "../../shared/api/artists";
import { getPosts } from "../../shared/api/posts";
import { markNoShow, proposeArtistTime, withdrawProposal } from "../../shared/api/providerExit";
import { toPersianDigits } from "../../shared/lib/digits";
import { buildClockOptions, getTodayPersianWeekday, timeLabelToMinutes } from "../../shared/lib/time";
import { mapPortfolioItem } from "../posts/mappers";
import {
  buildArtistBookingWeekTabs,
  getArtistBookingDayRank,
  mapArtistBooking,
  resolveBookingDateToWeekday,
  sortArtistBookingsNearest
} from "./bookingUtils";
import { readArtistRailDock } from "./railUtils";
import { useArtistWorkActions } from "./useArtistWorkActions";
import { useArtistRailDrag } from "./useArtistRailDrag";
import { useArtistHours } from "./useArtistHours";
import { exitRefusalOf, openExitDialog } from "../exit/exitDialogBus";

/**
 * Artist-owner workspace: portfolio, services, bookings, break, outbound collabs,
 * inbound salon invites, booking rail chrome.
 *
 * scheduleNow / scheduleViewDay / scheduleBookingMenu stay in HomeApp (shared with salon).
 * Salon-side collab inbox / salon-sent invites stay in HomeApp.
 *
 * Public client bookings (POST /api/artist/bookings) sync via:
 * - 8s poll of GET /api/artist/me (epoch-guarded), and/or
 * - notifyArtistBookingCreated(artistUserId) when the logged-in artist is the booking target.
 *
 * @param {{
 *   createdProfile?: { id?: number|string, type?: string, data?: Record<string, unknown> } | null,
 *   activeTab?: string,
 *   salonDirectory?: Array<Record<string, unknown>>,
 *   onNotice?: (msg: string) => void,
 *   onShellNotice?: (msg: string) => void,
 *   onPostsChanged?: () => Promise<void> | void,
 *   onCloseBookingSheet?: () => void
 * }} options
 */
export function useArtistWorkspace({
  createdProfile = null,
  activeTab = "profile",
  salonDirectory = [],
  onNotice,
  onShellNotice,
  onPostsChanged,
  onCloseBookingSheet
} = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const shellNotify = useCallback((message) => {
    if (typeof onShellNotice === "function" && message) onShellNotice(message);
    else notify(message);
  }, [onShellNotice, notify]);

  const artistBookingsEpochRef = useRef(0);
  const artistRailRef = useRef(null);
  const artistRailDragRef = useRef({
    pointerId: null,
    armed: false,
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    offsetX: 0,
    offsetY: 0,
    pending: null,
    raf: 0,
    longPressTimer: null
  });

  const [artistSocialStats, setArtistSocialStats] = useState({ followers: 0 });
  const [artistSalonInviteList, setArtistSalonInviteList] = useState([]);
  const [artistTeams, setArtistTeams] = useState([]);
  const [artistTeamBusyId, setArtistTeamBusyId] = useState("");
  const [artistWorkSaving, setArtistWorkSaving] = useState(false);
  const [artistInviteRespondBusyId, setArtistInviteRespondBusyId] = useState("");
  const artistBookingSubmittingRef = useRef(false);
  const [artistBreakSaving, setArtistBreakSaving] = useState(false);
  const [artistRequestBusyId, setArtistRequestBusyId] = useState("");
  const artistRequestBusyIdRef = useRef("");
  const [artistWorkspaceLoading, setArtistWorkspaceLoading] = useState(true);
  const [artistGalleryFilter, setArtistGalleryFilter] = useState("همه");
  const [artistPortfolioItems, setArtistPortfolioItems] = useState([]);
  const [previewingArtistWorkId, setPreviewingArtistWorkId] = useState(null);
  const [editingArtistWork, setEditingArtistWork] = useState(null);
  const [artistWorkTagMenuOpen, setArtistWorkTagMenuOpen] = useState(false);
  const [artistBookingList, setArtistBookingList] = useState([]);
  const [artistServiceList, setArtistServiceList] = useState([]);
  const [artistBreakTime, setArtistBreakTime] = useState(null);
  const [artistBreakEditorOpen, setArtistBreakEditorOpen] = useState(false);
  const [artistBreakDraft, setArtistBreakDraft] = useState({ start: "۱۳:۰۰", end: "۱۴:۰۰" });
  const [artistBookingCreateOpen, setArtistBookingCreateOpen] = useState(false);
  const [artistCollabOffers, setArtistCollabOffers] = useState([]);
  const [artistCollabDraft, setArtistCollabDraft] = useState({
    salonId: "",
    days: "شنبه، دوشنبه، چهارشنبه",
    from: "۱۰:۰۰",
    to: "۱۸:۰۰",
    share: "۴۰",
    capacity: "۴"
  });
  const [artistBookingRailOpen, setArtistBookingRailOpen] = useState(false);
  const [artistBookingSelectedDay, setArtistBookingSelectedDay] = useState(getTodayPersianWeekday());
  const [artistHoursList, setArtistHoursList] = useState([]);
  const [artistHoursOpen, setArtistHoursOpen] = useState(false);
  const [artistRailDock, setArtistRailDock] = useState({ wall: "left", along: 1 });
  const [artistRailDragging, setArtistRailDragging] = useState(false);
  const [artistRailDragPos, setArtistRailDragPos] = useState(null);
  const [artistRailSize, setArtistRailSize] = useState({ w: 68, h: 200 });

  // The owner always sees every one of their own posts (the server already orders pinned
  // first, then newest) -- never filtered down by profile specialty.
  const visibleArtistPortfolio = artistPortfolioItems;

  const artistGalleryTags = useMemo(() => {
    const tags = Array.from(new Set(visibleArtistPortfolio.map((item) => item.tag)));
    return ["همه", ...tags];
  }, [visibleArtistPortfolio]);

  const artistGalleryItems = useMemo(() => {
    if (artistGalleryFilter === "همه") return visibleArtistPortfolio;
    return visibleArtistPortfolio.filter((item) => item.tag === artistGalleryFilter);
  }, [visibleArtistPortfolio, artistGalleryFilter]);

  const previewingArtistWork = useMemo(
    () => artistPortfolioItems.find((item) => item.id === previewingArtistWorkId) || null,
    [artistPortfolioItems, previewingArtistWorkId]
  );

  // Post categories are exactly the services on the artist's menu.
  const artistWorkTagOptions = useMemo(
    () => Array.from(new Set(artistServiceList.map((item) => String(item.name || "").trim()).filter(Boolean))),
    [artistServiceList]
  );

  const nearestArtistBookings = useMemo(
    () => sortArtistBookingsNearest(
      artistBookingList.filter((booking) => getArtistBookingDayRank(booking.date) === 0)
    ).slice(0, 3),
    [artistBookingList]
  );

  const artistBookingWeekTabs = useMemo(() => buildArtistBookingWeekTabs(), []);

  const artistScheduleDayLabel = useMemo(() => (
    artistBookingWeekTabs.find((item) => item.day === artistBookingSelectedDay)?.label || artistBookingSelectedDay
  ), [artistBookingWeekTabs, artistBookingSelectedDay]);

  const pendingArtistSalonInvites = useMemo(() => (
    artistSalonInviteList.filter((item) => item.status === "در انتظار تایید")
  ), [artistSalonInviteList]);

  const artistUnreadNoticeCount = useMemo(() => (
    pendingArtistSalonInvites.length
  ), [pendingArtistSalonInvites.length]);

  const refreshArtistWorkspace = useCallback(async () => {
    const epoch = ++artistBookingsEpochRef.current;
    try {
      const [postsRes, meRes, hoursRes, teamsRes] = await Promise.all([getPosts(), getArtistMe(), getArtistHours(), getArtistTeams()]);
      if (teamsRes.ok) setArtistTeams(teamsRes.data?.teams || []);
      if (postsRes.ok) {
        setArtistPortfolioItems((postsRes.data?.posts || []).map(mapPortfolioItem).filter(Boolean));
      }
      if (hoursRes.ok && epoch === artistBookingsEpochRef.current) {
        setArtistHoursList(hoursRes.data?.hours || []);
      }
      if (meRes.ok) {
        const data = meRes.data || {};
        if (epoch === artistBookingsEpochRef.current) {
          setArtistServiceList(data.services || []);
          setArtistBookingList((data.bookings || []).map(mapArtistBooking).filter(Boolean));
          setArtistCollabOffers(data.collabs || []);
          setArtistSalonInviteList(data.invites || []);
          setArtistBreakTime(data.breakTime || null);
          setArtistSocialStats({
            followers: Number(data.followers || 0)
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setArtistWorkspaceLoading(false);
    }
  }, []);

  const refreshArtistBookingsOnly = useCallback(async () => {
    const epoch = artistBookingsEpochRef.current;
    try {
      const meRes = await getArtistMe();
      if (meRes.ok && epoch === artistBookingsEpochRef.current) {
        setArtistBookingList((meRes.data?.bookings || []).map(mapArtistBooking).filter(Boolean));
      }
    } catch {
      // keep current bookings
    }
  }, []);
  const {
    activeArtistHours,
    saveArtistHoursWeek,
  } = useArtistHours({
    artistHoursList,
    shellNotify,
    setArtistHoursList
  });


  /**
   * Called after a successful public booking (POST /api/artist/bookings).
   * Only refreshes when the logged-in artist is the booking target.
   */
  const notifyArtistBookingCreated = useCallback(async (artistUserId) => {
    if (createdProfile?.type !== "artist") return;
    if (String(createdProfile?.id) !== String(artistUserId)) return;
    artistBookingsEpochRef.current += 1;
    await refreshArtistWorkspace();
  }, [createdProfile?.type, createdProfile?.id, refreshArtistWorkspace]);

  const resetArtistWorkspace = useCallback(() => {
    artistBookingsEpochRef.current += 1;
    setArtistPortfolioItems([]);
    setArtistServiceList([]);
    setArtistWorkspaceLoading(true);
    setArtistBreakTime(null);
    setArtistBreakEditorOpen(false);
    setArtistBookingList([]);
    setArtistCollabOffers([]);
    setArtistSalonInviteList([]);
    setArtistSocialStats({ followers: 0 });
    setArtistBookingCreateOpen(false);
    setArtistBookingRailOpen(false);
    setEditingArtistWork(null);
    setPreviewingArtistWorkId(null);
    setArtistWorkTagMenuOpen(false);
    setArtistWorkspaceLoading(true);
    setArtistHoursList([]);
    setArtistHoursOpen(false);
  }, []);

  usePolling(refreshArtistBookingsOnly, 20000, createdProfile?.type === "artist");
  useAppRefresh(refreshArtistWorkspace, createdProfile?.type === "artist");

  useEffect(() => {
    if (!artistGalleryTags.includes(artistGalleryFilter)) {
      setArtistGalleryFilter("همه");
    }
  }, [artistGalleryTags, artistGalleryFilter]);

  useEffect(() => {
    setArtistRailDock(readArtistRailDock());
  }, []);

  useEffect(() => {
    const rail = artistRailRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return undefined;
    const updateSize = () => {
      setArtistRailSize({ w: rail.offsetWidth || 68, h: rail.offsetHeight || 200 });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [createdProfile?.type, activeTab, artistBookingRailOpen, artistRailDock.wall]);

  useEffect(() => {
    if (activeTab !== "profile" || createdProfile?.type !== "artist") {
      setArtistBookingRailOpen(false);
      setArtistRailDragging(false);
      setArtistRailDragPos(null);
    }
  }, [activeTab, createdProfile?.type]);
  const {
    clearArtistRailLongPress,
    flushArtistRailDragPos,
    beginArtistRailDrag,
    onArtistRailHandlePointerDown,
    onArtistRailHandlePointerMove,
    onArtistRailHandlePointerUp
  } = useArtistRailDrag({
    artistRailDragRef,
    setArtistRailDragPos,
    artistRailRef,
    setArtistRailDragging,
    setArtistBookingRailOpen,
    artistRailSize,
    setArtistRailDock
  });


  /**
   * The artist's own booking from the booking form (VisitBooker): one entry as long as all the services
   * together. Resolves { ok, status, payload } so the form can say what went wrong; a clash with another
   * booking is answered by a fresh look at the calendar, so the form's list of free times is current.
   */
  async function submitArtistVisit(body) {
    if (artistBookingSubmittingRef.current) return { ok: false, status: 0, payload: { error: "قبلیه هنوز تموم نشده؛ یه لحظه صبر کن." } };
    artistBookingSubmittingRef.current = true;
    try {
      const { ok, status, payload } = await createArtistMe(body);
      if (!ok) {
        if (status === 409) void refreshArtistWorkspace();
        return { ok: false, status, payload };
      }
      const created = mapArtistBooking(payload.data?.booking) || {
        id: payload.data?.booking?.id || `local-${Date.now()}`,
        time: body.time,
        date: body.date,
        client: body.client,
        phone: body.phone,
        service: body.service,
        status: "تایید",
        durationMinutes: body.durationMinutes,
        history: "day",
        visits: Array.from({ length: 10 }, () => 0)
      };
      artistBookingsEpochRef.current += 1;
      if (Array.isArray(payload.data?.bookings)) {
        setArtistBookingList(payload.data.bookings.map(mapArtistBooking).filter(Boolean));
      } else {
        setArtistBookingList((list) => {
          if (list.some((item) => String(item.id) === String(created.id))) return list;
          return [created, ...list];
        });
      }
      setArtistBookingSelectedDay(resolveBookingDateToWeekday(created.date || body.date));
      setArtistBookingCreateOpen(false);
      setArtistBookingRailOpen(true);
      if (typeof onCloseBookingSheet === "function") onCloseBookingSheet();
      notify(`نوبت ${body.time} برای ${body.client} ثبت شد.`);
      void refreshArtistWorkspace();
      return { ok: true, status, payload };
    } catch {
      return { ok: false, status: 0, payload: {} };
    } finally {
      artistBookingSubmittingRef.current = false;
    }
  }

  function openArtistBreakEditor() {
    const start = artistBreakTime?.start || "۱۳:۰۰";
    let end = artistBreakTime?.end || "۱۴:۰۰";
    if (timeLabelToMinutes(end) <= timeLabelToMinutes(start)) {
      end = buildClockOptions().find((slot) => timeLabelToMinutes(slot) > timeLabelToMinutes(start)) || "۱۴:۰۰";
    }
    setArtistBreakDraft({ start, end });
    setArtistBreakEditorOpen(true);
  }

  function closeArtistBreakEditor() {
    setArtistBreakEditorOpen(false);
  }

  async function saveArtistBreakTime() {
    if (artistBreakSaving) return;
    if (timeLabelToMinutes(artistBreakDraft.end) <= timeLabelToMinutes(artistBreakDraft.start)) {
      notify("آخر استراحت باید بعد از اولش باشه.");
      return;
    }
    setArtistBreakSaving(true);
    try {
      const { ok, payload } = await createArtistMe({
        kind: "break",
        startTime: artistBreakDraft.start,
        endTime: artistBreakDraft.end
      });
      if (!ok) {
        notify(payload.error || "استراحت ذخیره نشد؛ دوباره بزن.");
        return;
      }
      setArtistBreakTime(payload.data?.breakTime || {
        start: artistBreakDraft.start,
        end: artistBreakDraft.end
      });
      setArtistBreakEditorOpen(false);
      notify(`تایم استراحت ${artistBreakDraft.start} تا ${artistBreakDraft.end} ذخیره شد.`);
    } catch {
      notify("استراحت ذخیره نشد؛ دوباره بزن.");
    } finally {
      setArtistBreakSaving(false);
    }
  }

  async function clearArtistBreakTime() {
    if (artistBreakSaving) return;
    setArtistBreakSaving(true);
    try {
      const { ok } = await createArtistMe({ kind: "break", clear: true });
      if (!ok) {
        notify("استراحت پاک نشد؛ دوباره بزن.");
        return;
      }
      setArtistBreakTime(null);
      setArtistBreakEditorOpen(false);
      notify("استراحت پاک شد.");
    } catch {
      notify("استراحت پاک نشد؛ دوباره بزن.");
    } finally {
      setArtistBreakSaving(false);
    }
  }

  async function deleteArtistService(id) {
    const target = artistServiceList.find((item) => item.id === id);
    if (typeof window !== "undefined" && !window.confirm(target ? `«${target.name}» پاک بشه؟ این کار برگشت نداره.` : "این خدمت پاک بشه؟ این کار برگشت نداره.")) {
      return false;
    }
    try {
      const { ok, payload } = await deleteArtistMe({ id });
      if (!ok) {
        notify(payload.error || "خدمت پاک نشد؛ دوباره بزن.");
        return false;
      }
      await refreshArtistWorkspace();
      notify("خدمت پاک شد.");
      return true;
    } catch {
      notify("خدمت پاک نشد؛ دوباره بزن.");
      return false;
    }
  }

  /** Artist-only service create/update via /api/artist/me (salon path stays in HomeApp). */
  async function upsertArtistOwnerService(body, { editingId } = {}) {
    const { ok, payload } = editingId
      ? await updateArtistMe({ id: editingId, ...body })
      : await createArtistMe(body);
    if (!ok) {
      notify(payload.error || (editingId ? "خدمت ذخیره نشد؛ دوباره بزن." : "خدمت اضافه نشد؛ دوباره بزن."));
      return false;
    }
    await refreshArtistWorkspace();
    return true;
  }

  async function addArtistCollabOffer(event) {
    event.preventDefault();
    const salon = salonDirectory.find((item) => (
      String(item.id) === String(artistCollabDraft.salonId)
      || String(item.source_key) === String(artistCollabDraft.salonId)
      || item.name === artistCollabDraft.salonId
    )) || salonDirectory[0];
    if (!salon) {
      notify("هنوز سالنی پیدا نشد.");
      return;
    }
    const service = String(createdProfile?.data?.service || artistServiceList[0]?.name || "").trim();
    const days = String(artistCollabDraft.days || "").trim();
    const from = String(artistCollabDraft.from || "").trim();
    const to = String(artistCollabDraft.to || "").trim();
    const share = String(artistCollabDraft.share || "").trim();
    const capacity = String(artistCollabDraft.capacity || "").trim();
    if (!service || !days || !from || !to || !share) {
      notify(service ? "روز، ساعت و سهمت رو کامل کن." : "اول کارهات یا یه خدمت رو بذار.");
      return;
    }
    if (timeLabelToMinutes(to) <= timeLabelToMinutes(from)) {
      notify("ساعت آخر باید بعد از اول باشه.");
      return;
    }
    try {
      const { ok, payload } = await createArtistMe({
        kind: "collab",
        salonId: salon.id,
        salonName: salon.name || "سالن منتخب",
        area: salon.area || salon.city || "",
        service,
        days,
        from,
        to,
        share,
        capacity: capacity || "۱",
        status: "آماده ارسال"
      });
      if (!ok) {
        notify(payload.error || "پیشنهاد همکاری نرفت؛ دوباره بزن.");
        return;
      }
      setArtistCollabOffers((items) => ([payload.data?.collab, ...items].filter(Boolean)));
      notify("پیشنهاد همکاریت آماده‌ست.");
    } catch {
      notify("پیشنهاد همکاری نرفت؛ دوباره بزن.");
    }
  }

  async function deleteArtistCollabOffer(id) {
    if (typeof window !== "undefined" && !window.confirm("این پیشنهاد همکاری پاک بشه؟")) {
      return;
    }
    try {
      const { ok, payload } = await deleteArtistMe({ kind: "collab", id });
      if (!ok) {
        notify(payload.error || "پاک نشد؛ دوباره بزن.");
        return;
      }
      setArtistCollabOffers((items) => items.filter((item) => item.id !== id));
      notify("پیشنهاد همکاری پاک شد.");
    } catch {
      notify("پاک نشد؛ دوباره بزن.");
    }
  }
  const {
    openArtistWorkPreview,
    closeArtistWorkPreview,
    openArtistWorkModal,
    closeArtistWorkModal,
    clearArtistWorkImage,
    syncArtistPosts,
    saveArtistWork,
    deleteArtistWork
  } = useArtistWorkActions({
    artistServiceList,
    setPreviewingArtistWorkId,
    setArtistWorkTagMenuOpen,
    setEditingArtistWork,
    onPostsChanged,
    createdProfile,
    refreshArtistWorkspace,
    editingArtistWork,
    artistWorkSaving,
    setArtistWorkSaving,
    notify,
    setArtistPortfolioItems
  });


  /**
   * Confirms a REAL pending direct artist_bookings row (status "تازه") via
   * PATCH /api/artist/me — mirrors approveReservationRequest in
   * useSalonWorkspace.js exactly (same optimistic-list-replace shape),
   * for the direct-artist-booking equivalent of that salon flow.
   */
  const confirmArtistBookingRequest = useCallback(async (bookingId) => {
    if (artistRequestBusyIdRef.current) return;
    const busyKey = `booking:${bookingId}`;
    artistRequestBusyIdRef.current = busyKey;
    setArtistRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateArtistBooking({ id: bookingId, status: "تایید شده" });
      if (!ok) {
        shellNotify(payload?.error || "تأیید نشد؛ دوباره بزن.");
        return;
      }
      if (Array.isArray(payload.data?.bookings)) {
        setArtistBookingList(payload.data.bookings.map(mapArtistBooking).filter(Boolean));
      }
      shellNotify("تأیید شد؛ مشتری خبردار شد.");
    } catch {
      shellNotify("تأیید نشد؛ دوباره بزن.");
    } finally {
      artistRequestBusyIdRef.current = "";
      setArtistRequestBusyId("");
    }
  }, [shellNotify]);

  /**
   * Declines (cancels) a REAL pending direct artist_bookings row — mirrors
   * declineReservationRequest in useSalonWorkspace.js, same cancel path
   * (status "لغو", action "cancel") PATCH /api/artist/me now supports.
   */
  const declineArtistBookingRequest = useCallback(async (bookingId) => {
    if (artistRequestBusyIdRef.current) return;
    const busyKey = `booking:${bookingId}`;
    artistRequestBusyIdRef.current = busyKey;
    setArtistRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateArtistBooking({ id: bookingId, status: "لغو", action: "cancel" });
      if (!ok) {
        shellNotify(payload?.error || "رد نشد؛ دوباره بزن.");
        return;
      }
      if (Array.isArray(payload.data?.bookings)) {
        setArtistBookingList(payload.data.bookings.map(mapArtistBooking).filter(Boolean));
      }
      shellNotify("رد شد؛ مشتری خبردار شد.");
    } catch {
      shellNotify("رد نشد؛ دوباره بزن.");
    } finally {
      artistRequestBusyIdRef.current = "";
      setArtistRequestBusyId("");
    }
  }, [shellNotify]);

  /**
   * One change to the artist's own confirmed direct booking from its screen: «نیومد», «پیشنهاد ساعت دیگه», taking the
   * proposal back, or cancelling with notice. The list comes back from the server; true when it went through.
   */
  const runArtistBookingCall = useCallback(async (bookingId, call, notice) => {
    if (artistRequestBusyIdRef.current) return false;
    const busyKey = `booking:${bookingId}`;
    artistRequestBusyIdRef.current = busyKey;
    setArtistRequestBusyId(busyKey);
    try {
      const { ok, payload } = await call();
      if (!ok) {
        shellNotify(payload?.error || "نشد؛ دوباره بزن.");
        return false;
      }
      if (Array.isArray(payload.data?.bookings)) {
        setArtistBookingList(payload.data.bookings.map(mapArtistBooking).filter(Boolean));
      }
      shellNotify(notice);
      return true;
    } catch {
      shellNotify("نشد؛ دوباره بزن.");
      return false;
    } finally {
      artistRequestBusyIdRef.current = "";
      setArtistRequestBusyId("");
    }
  }, [shellNotify]);

  const markArtistNoShow = useCallback((bookingId, noShow) => runArtistBookingCall(
    bookingId,
    () => markNoShow({ kind: "artist", id: bookingId, noShow }),
    noShow ? "زدی که نیومد." : "برگشت؛ دیگه «نیومد» نیست."
  ), [runArtistBookingCall]);

  const proposeArtistBookingTime = useCallback((bookingId, time) => runArtistBookingCall(
    bookingId,
    () => proposeArtistTime({ id: bookingId, time }),
    `ساعت ${toPersianDigits(time)} رو به مشتری پیشنهاد دادیم. تا قبول نکنه، نوبت همون ساعت قبلی می‌مونه.`
  ), [runArtistBookingCall]);

  const withdrawArtistProposal = useCallback((bookingId) => runArtistBookingCall(
    bookingId,
    () => withdrawProposal({ kind: "artist", id: bookingId }),
    "پیشنهاد رو پس گرفتی؛ نوبت همون ساعت قبلیه."
  ), [runArtistBookingCall]);

  const cancelArtistConfirmedBooking = useCallback((bookingId) => runArtistBookingCall(
    bookingId,
    () => updateArtistBooking({ id: bookingId, status: "لغو", action: "cancel" }),
    "نوبت لغو شد؛ مشتری خبردار شد."
  ), [runArtistBookingCall]);

  async function respondArtistSalonInvite(inviteId, status) {
    if (!inviteId || artistInviteRespondBusyId) return;
    setArtistInviteRespondBusyId(String(inviteId));
    try {
      const { ok, payload } = await respondArtistInvite({ id: inviteId, status });
      if (!ok) {
        shellNotify(payload.error || "جوابت نرسید؛ دوباره بزن.");
        return false;
      }
      setArtistSalonInviteList(payload.data?.invites || []);
      if (status === "تایید شد") {
        const teamsRes = await getArtistTeams();
        if (teamsRes.ok) setArtistTeams(teamsRes.data?.teams || []);
      }
      shellNotify(status === "تایید شد"
        ? "قبول کردی؛ حالا توی تیم سالنی!"
        : "دعوت رو رد کردی.");
      return true;
    } catch {
      shellNotify("جوابت نرسید؛ دوباره بزن.");
    } finally {
      setArtistInviteRespondBusyId("");
    }
    return false;
  }

  async function leaveArtistSalonTeam(salonUserId) {
    if (!salonUserId || artistTeamBusyId) return;
    if (typeof window !== "undefined" && !window.confirm("از تیم می‌ری بیرون و دیگه توی برنامهٔ سالن نیستی. مطمئنی؟")) return;
    setArtistTeamBusyId(String(salonUserId));
    // One try; a refusal because of confirmed bookings (owner's rules of 2026-10-22) opens the list dialog, whose
    // «ادامه» repeats this same try (with «لغو همهٔ نوبت‌ها» when chosen).
    const attempt = async ({ cancelAll = false } = {}) => {
      const result = await leaveArtistTeam({ salonUserId, ...(cancelAll ? { cancelAll: true } : {}) });
      if (result.ok) {
        setArtistTeams(result.payload.data?.teams || []);
        shellNotify("از تیم اومدی بیرون.");
        return { ok: true };
      }
      const refusal = exitRefusalOf(result);
      if (refusal) return { ok: false, plan: refusal.plan, message: refusal.message, refusal };
      return { ok: false, message: result.payload?.error || "از تیم بیرون نیومدی؛ دوباره بزن." };
    };
    try {
      const result = await attempt();
      if (result.ok) return;
      if (result.refusal) {
        openExitDialog({
          scope: "team",
          params: { salonUserId },
          plan: result.plan,
          message: result.message,
          title: "از تیم بری بیرون؟",
          confirmLabel: "آره، برم بیرون",
          retry: attempt
        });
        return;
      }
      shellNotify(result.message);
    } catch {
      shellNotify("از تیم بیرون نیومدی؛ دوباره بزن.");
    } finally {
      setArtistTeamBusyId("");
    }
  }

  return {
    artistWorkSaving,
    artistTeams,
    artistTeamBusyId,
    leaveArtistSalonTeam,
    artistBookingsEpochRef,
    artistSocialStats,
    artistSalonInviteList,
    setArtistSalonInviteList,
    artistInviteRespondBusyId,
    artistRequestBusyId,
    confirmArtistBookingRequest,
    declineArtistBookingRequest,
    markArtistNoShow,
    proposeArtistBookingTime,
    withdrawArtistProposal,
    cancelArtistConfirmedBooking,
    artistWorkspaceLoading,
    artistGalleryFilter,
    setArtistGalleryFilter,
    artistPortfolioItems,
    setArtistPortfolioItems,
    previewingArtistWorkId,
    setPreviewingArtistWorkId,
    editingArtistWork,
    setEditingArtistWork,
    artistWorkTagMenuOpen,
    setArtistWorkTagMenuOpen,
    artistBookingList,
    setArtistBookingList,
    artistServiceList,
    setArtistServiceList,
    artistBreakTime,
    setArtistBreakTime,
    artistBreakEditorOpen,
    setArtistBreakEditorOpen,
    artistBreakDraft,
    setArtistBreakDraft,
    artistBreakSaving,
    artistBookingCreateOpen,
    setArtistBookingCreateOpen,
    artistCollabOffers,
    setArtistCollabOffers,
    artistCollabDraft,
    setArtistCollabDraft,
    artistBookingRailOpen,
    setArtistBookingRailOpen,
    artistBookingSelectedDay,
    setArtistBookingSelectedDay,
    artistHoursList,
    artistHoursOpen,
    setArtistHoursOpen,
    openArtistHoursDaysCount: activeArtistHours.length,
    saveArtistHoursWeek,
    artistRailDock,
    setArtistRailDock,
    artistRailDragging,
    artistRailDragPos,
    artistRailSize,
    artistRailRef,
    artistRailDragRef,
    visibleArtistPortfolio,
    artistGalleryTags,
    artistGalleryItems,
    previewingArtistWork,
    artistWorkTagOptions,
    nearestArtistBookings,
    artistBookingWeekTabs,
    artistScheduleDayLabel,
    pendingArtistSalonInvites,
    artistUnreadNoticeCount,
    refreshArtistWorkspace,
    refreshArtistBookingsOnly,
    notifyArtistBookingCreated,
    resetArtistWorkspace,
    clearArtistRailLongPress,
    flushArtistRailDragPos,
    beginArtistRailDrag,
    onArtistRailHandlePointerDown,
    onArtistRailHandlePointerMove,
    onArtistRailHandlePointerUp,
    submitArtistVisit,
    openArtistBreakEditor,
    closeArtistBreakEditor,
    saveArtistBreakTime,
    clearArtistBreakTime,
    deleteArtistService,
    upsertArtistOwnerService,
    addArtistCollabOffer,
    deleteArtistCollabOffer,
    openArtistWorkPreview,
    closeArtistWorkPreview,
    openArtistWorkModal,
    closeArtistWorkModal,
    clearArtistWorkImage,
    syncArtistPosts,
    saveArtistWork,
    deleteArtistWork,
    respondArtistSalonInvite
  };
}
