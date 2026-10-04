"use client";

import { usePolling } from "../../shared/lib/usePolling";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createArtistMe,
  deleteArtistMe,
  getArtistHours,
  getArtistMe,
  respondArtistInvite,
  getArtistTeams,
  leaveArtistTeam,
  updateArtistBooking,
  updateArtistHours,
  updateArtistMe
} from "../../shared/api/artists";
import { createPost, deletePost, getPosts, updatePost } from "../../shared/api/posts";
import {
  buildClockOptions,
  getTodayPersianWeekday,
  SALON_HOUR_TIME_OPTIONS,
  timeLabelToMinutes
} from "../../shared/lib/time";
import { mapPortfolioItem } from "../posts/mappers";
import {
  buildArtistBookingWeekTabs,
  getArtistBookingDayRank,
  mapArtistBooking,
  resolveBookingDateToWeekday,
  sortArtistBookingsNearest
} from "./bookingUtils";
import {
  ARTIST_RAIL_DOCK_KEY,
  clampRail,
  getArtistRailFrame,
  readArtistRailDock,
  snapArtistRailDock
} from "./railUtils";

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
  const [artistBookingSubmitting, setArtistBookingSubmitting] = useState(false);
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
  const [artistBookingSettings, setArtistBookingSettings] = useState({
    directBooking: true,
    autoConfirm: false,
    reminders: true,
    vacationMode: false
  });
  const [artistBookingSelectedDay, setArtistBookingSelectedDay] = useState(getTodayPersianWeekday());
  const [artistHoursList, setArtistHoursList] = useState([]);
  const [artistHoursOpen, setArtistHoursOpen] = useState(false);
  const [selectedArtistHourDay, setSelectedArtistHourDay] = useState("");
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

  const artistHoursPresets = [
    { id: "standard", label: "معمولی", detail: "شنبه تا چهارشنبه · ۱۰ تا ۲۰ · ظرفیت ۸" },
    { id: "extended", label: "پرفشار", detail: "همه روزها باز · ۱۰ تا ۲۲ · ظرفیت ۱۲" },
    { id: "weekend", label: "آخر هفته", detail: "پنجشنبه و جمعه · ۱۲ تا ۱۸ · ظرفیت ۵" }
  ];

  const activeArtistHoursPreset = useMemo(() => {
    if (!artistHoursList.length) return null;
    const weekendDays = new Set(["پنجشنبه", "جمعه"]);
    const matches = (predicate) => artistHoursList.every(predicate);
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
  }, [artistHoursList]);
  const activeArtistHoursPresetMeta = artistHoursPresets.find((preset) => preset.id === activeArtistHoursPreset) || null;
  const activeArtistHours = useMemo(() => artistHoursList.filter((item) => item.active), [artistHoursList]);
  const weeklyArtistCapacityTotal = activeArtistHours.reduce((total, item) => total + Number(item.capacity || 0), 0);
  const selectedArtistHour = useMemo(() => {
    if (!artistHoursList.length) return null;
    return artistHoursList.find((hour) => hour.day === selectedArtistHourDay)
      || artistHoursList.find((hour) => hour.active)
      || artistHoursList[0]
      || null;
  }, [artistHoursList, selectedArtistHourDay]);
  const artistHourTimeOptions = useMemo(() => {
    const options = [...SALON_HOUR_TIME_OPTIONS];
    [selectedArtistHour?.open_time, selectedArtistHour?.close_time].forEach((value) => {
      if (value && !options.includes(value)) options.push(value);
    });
    return options;
  }, [selectedArtistHour]);

  const updateArtistHour = useCallback(async (hour, patch) => {
    const nextHour = { ...hour, ...patch };
    try {
      const result = await updateArtistHours(nextHour);
      if (!result.ok) {
        shellNotify(result.payload?.error || "به‌روزرسانی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      setArtistHoursList(result.payload.data?.hours || []);
    } catch {
      shellNotify("به‌روزرسانی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
    }
  }, [shellNotify]);

  const updateArtistHoursPreset = useCallback(async (preset) => {
    const weekendDays = new Set(["پنجشنبه", "جمعه"]);
    const nextHours = artistHoursList.map((hour) => {
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
      const results = await Promise.all(nextHours.map((hour) => updateArtistHours(hour)));
      const failed = results.find((item) => !item.ok);
      if (failed) {
        shellNotify(failed.payload?.error || "ذخیره گزینه کلی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      const latestHours = results[results.length - 1]?.payload?.data?.hours || nextHours;
      setArtistHoursList(latestHours);
    } catch {
      shellNotify("ذخیره گزینه کلی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
    }
  }, [artistHoursList, shellNotify]);

  /**
   * Copies one day's open/close time + capacity onto every other open day —
   * the "apply to the rest of the week" shortcut, so setting hours doesn't
   * mean repeating the same start/end time pick for each day one at a time.
   * Closed days are left alone.
   */
  const copyArtistHourToOpenDays = useCallback(async (sourceHour) => {
    const targets = artistHoursList.filter((hour) => hour.active);
    try {
      // Sequential on purpose (not Promise.all): several concurrent
      // authenticated PATCHes racing the session-touch poll (GET
      // /api/artist/me, see presence heartbeat) could land out of order and
      // make the client-side hours list flicker/reset mid-update.
      let latestHours = artistHoursList;
      for (const hour of targets) {
        const nextHour = { ...hour, open_time: sourceHour.open_time, close_time: sourceHour.close_time, capacity: sourceHour.capacity };
        const result = await updateArtistHours(nextHour);
        if (!result.ok) {
          shellNotify(result.payload?.error || "اعمال ساعت به بقیه روزها انجام نشد؛ دوباره امتحان کن.");
          return;
        }
        latestHours = result.payload.data?.hours || latestHours;
      }
      setArtistHoursList(latestHours);
      shellNotify("ساعت روی بقیه روزهای باز اعمال شد.");
    } catch {
      shellNotify("اعمال ساعت به بقیه روزها انجام نشد؛ دوباره امتحان کن.");
    }
  }, [artistHoursList, shellNotify]);

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
    setSelectedArtistHourDay("");
  }, []);

  usePolling(refreshArtistBookingsOnly, 10000, createdProfile?.type === "artist");

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

  function clearArtistRailLongPress() {
    const drag = artistRailDragRef.current;
    if (drag.longPressTimer) {
      window.clearTimeout(drag.longPressTimer);
      drag.longPressTimer = null;
    }
  }

  function flushArtistRailDragPos() {
    const drag = artistRailDragRef.current;
    drag.raf = 0;
    if (!drag.pending) return;
    setArtistRailDragPos(drag.pending);
    drag.pending = null;
  }

  function beginArtistRailDrag() {
    const rail = artistRailRef.current;
    const drag = artistRailDragRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    drag.dragging = true;
    drag.armed = true;
    drag.offsetX = drag.startX - rect.left;
    drag.offsetY = drag.startY - rect.top;
    setArtistRailDragging(true);
    setArtistBookingRailOpen(false);
    const frame = getArtistRailFrame();
    setArtistRailDragPos({
      x: clampRail(rect.left, frame.left + 8, frame.left + frame.width - rect.width - 8),
      y: clampRail(rect.top, frame.top + 8, frame.top + frame.height - rect.height - 8)
    });
    if (drag.pointerId != null) {
      try {
        const handle = rail.querySelector(".artistBookingRailHandle");
        (handle || rail).setPointerCapture(drag.pointerId);
      } catch {
        // ignore
      }
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(12);
    }
  }

  function onArtistRailHandlePointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    const drag = artistRailDragRef.current;
    clearArtistRailLongPress();
    drag.pointerId = event.pointerId;
    drag.armed = false;
    drag.dragging = false;
    drag.moved = false;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.originX = event.clientX;
    drag.originY = event.clientY;
    beginArtistRailDrag();
  }

  function onArtistRailHandlePointerMove(event) {
    const drag = artistRailDragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    drag.startX = event.clientX;
    drag.startY = event.clientY;

    const deltaX = Math.abs(event.clientX - (drag.originX ?? event.clientX));
    const deltaY = Math.abs(event.clientY - (drag.originY ?? event.clientY));
    if (!drag.dragging && (deltaX > 8 || deltaY > 8)) {
      clearArtistRailLongPress();
    }

    if (!drag.dragging) return;

    const rail = artistRailRef.current;
    const width = rail?.offsetWidth || artistRailSize.w;
    const height = rail?.offsetHeight || artistRailSize.h;
    const frame = getArtistRailFrame();
    const nextX = clampRail(event.clientX - drag.offsetX, frame.left + 8, frame.left + frame.width - width - 8);
    const nextY = clampRail(event.clientY - drag.offsetY, frame.top + 8, frame.top + frame.height - height - 8);
    drag.moved = true;
    drag.pending = { x: nextX, y: nextY };
    if (!drag.raf) {
      drag.raf = window.requestAnimationFrame(flushArtistRailDragPos);
    }
  }

  function onArtistRailHandlePointerUp(event) {
    const drag = artistRailDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    clearArtistRailLongPress();
    if (drag.raf) {
      window.cancelAnimationFrame(drag.raf);
      flushArtistRailDragPos();
    }

    if (drag.dragging) {
      const rail = artistRailRef.current;
      const width = rail?.offsetWidth || artistRailSize.w;
      const height = rail?.offsetHeight || artistRailSize.h;
      const rect = rail?.getBoundingClientRect();
      const centerX = rect ? rect.left + rect.width / 2 : event.clientX;
      const centerY = rect ? rect.top + rect.height / 2 : event.clientY;
      const dock = snapArtistRailDock(centerX, centerY, width, height);
      setArtistRailDock(dock);
      try {
        window.localStorage.setItem(ARTIST_RAIL_DOCK_KEY, JSON.stringify(dock));
      } catch {
        // ignore
      }
      setArtistRailDragging(false);
      setArtistRailDragPos(null);
      drag.dragging = false;
      drag.moved = true;
      window.setTimeout(() => {
        drag.moved = false;
      }, 220);
    }

    drag.pointerId = null;
    drag.armed = false;
    try {
      artistRailRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  async function handleArtistBookingCreate(event) {
    event.preventDefault();
    if (artistBookingSubmittingRef.current) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const client = String(data.client || "").trim();
    const phone = String(data.phone || "").trim();
    const service = String(data.service || "").trim();
    const time = String(data.time || "").trim();
    const date = String(data.date || "امروز").trim();
    if (!client || !service || !time) {
      notify("نام، خدمت و ساعت را کامل کن.");
      return;
    }
    const taken = artistBookingList.some((item) => item.time === time && item.date === date);
    if (taken) {
      notify("این ساعت در این روز قبلاً رزرو شده.");
      return;
    }
    artistBookingSubmittingRef.current = true;
    setArtistBookingSubmitting(true);
    try {
      const { ok, payload } = await createArtistMe({
        kind: "booking",
        client,
        phone,
        service,
        time,
        date,
        status: "تایید"
      });
      if (!ok) {
        notify(payload.error || "ثبت نوبت انجام نشد.");
        return;
      }
      const created = mapArtistBooking(payload.data?.booking) || {
        id: payload.data?.booking?.id || `local-${Date.now()}`,
        time,
        date,
        client,
        phone,
        service,
        status: "تایید",
        durationMinutes: 60,
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
      setArtistBookingSelectedDay(resolveBookingDateToWeekday(created.date || date));
      setArtistBookingCreateOpen(false);
      setArtistBookingRailOpen(true);
      if (typeof onCloseBookingSheet === "function") onCloseBookingSheet();
      notify(`نوبت ${time} برای ${client} ثبت شد.`);
      try {
        form.reset();
      } catch {
        // form may unmount with the sheet
      }
      await refreshArtistWorkspace();
    } catch {
      notify("ثبت نوبت انجام نشد.");
    } finally {
      artistBookingSubmittingRef.current = false;
      setArtistBookingSubmitting(false);
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
      notify("پایان استراحت باید بعد از شروع باشد.");
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
        notify(payload.error || "ذخیره تایم استراحت انجام نشد.");
        return;
      }
      setArtistBreakTime(payload.data?.breakTime || {
        start: artistBreakDraft.start,
        end: artistBreakDraft.end
      });
      setArtistBreakEditorOpen(false);
      notify(`تایم استراحت ${artistBreakDraft.start} تا ${artistBreakDraft.end} ذخیره شد.`);
    } catch {
      notify("ذخیره تایم استراحت انجام نشد.");
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
        notify("حذف تایم استراحت انجام نشد.");
        return;
      }
      setArtistBreakTime(null);
      setArtistBreakEditorOpen(false);
      notify("تایم استراحت حذف شد.");
    } catch {
      notify("حذف تایم استراحت انجام نشد.");
    } finally {
      setArtistBreakSaving(false);
    }
  }

  async function deleteArtistService(id) {
    const target = artistServiceList.find((item) => item.id === id);
    if (typeof window !== "undefined" && !window.confirm(target ? `«${target.name}» حذف شود؟ این کار قابل بازگشت نیست.` : "این خدمت حذف شود؟ این کار قابل بازگشت نیست.")) {
      return;
    }
    try {
      const { ok, payload } = await deleteArtistMe({ id });
      if (!ok) {
        notify(payload.error || "حذف خدمت انجام نشد.");
        return;
      }
      await refreshArtistWorkspace();
      notify("خدمت حذف شد.");
    } catch {
      notify("حذف خدمت انجام نشد.");
    }
  }

  /** Artist-only service create/update via /api/artist/me (salon path stays in HomeApp). */
  async function upsertArtistOwnerService(body, { editingId } = {}) {
    const { ok, payload } = editingId
      ? await updateArtistMe({ id: editingId, ...body })
      : await createArtistMe(body);
    if (!ok) {
      notify(payload.error || (editingId ? "ویرایش خدمت انجام نشد." : "افزودن خدمت انجام نشد."));
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
      notify("اول باید یک سالن در سیستم وجود داشته باشد.");
      return;
    }
    const service = String(createdProfile?.data?.service || artistServiceList[0]?.name || "").trim();
    const days = String(artistCollabDraft.days || "").trim();
    const from = String(artistCollabDraft.from || "").trim();
    const to = String(artistCollabDraft.to || "").trim();
    const share = String(artistCollabDraft.share || "").trim();
    const capacity = String(artistCollabDraft.capacity || "").trim();
    if (!service || !days || !from || !to || !share) {
      notify(service ? "روز، ساعت و درصد همکاری را کامل کن." : "اول تخصص پروفایل یا یک خدمت آرتیست را ثبت کن.");
      return;
    }
    if (timeLabelToMinutes(to) <= timeLabelToMinutes(from)) {
      notify("ساعت پایان باید بعد از شروع باشد.");
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
        notify(payload.error || "ثبت همکاری انجام نشد.");
        return;
      }
      setArtistCollabOffers((items) => ([payload.data?.collab, ...items].filter(Boolean)));
      notify("پیشنهاد همکاری ساخته شد.");
    } catch {
      notify("ثبت همکاری انجام نشد.");
    }
  }

  async function deleteArtistCollabOffer(id) {
    if (typeof window !== "undefined" && !window.confirm("این پیشنهاد همکاری حذف شود؟")) {
      return;
    }
    try {
      const { ok, payload } = await deleteArtistMe({ kind: "collab", id });
      if (!ok) {
        notify(payload.error || "حذف همکاری انجام نشد.");
        return;
      }
      setArtistCollabOffers((items) => items.filter((item) => item.id !== id));
      notify("پیشنهاد همکاری حذف شد.");
    } catch {
      notify("حذف همکاری انجام نشد.");
    }
  }

  function openArtistWorkPreview(item) {
    if (!item?.id) return;
    setPreviewingArtistWorkId(item.id);
  }

  function closeArtistWorkPreview() {
    setPreviewingArtistWorkId(null);
  }

  function openArtistWorkModal(item) {
    if (!item) return;
    setPreviewingArtistWorkId(null);
    setArtistWorkTagMenuOpen(false);
    setEditingArtistWork({
      id: item.id,
      title: item.title || "",
      tag: item.tag || "",
      caption: item.caption || "",
      image: item.image || "",
      saves: item.saves || "۰",
      views: item.views || "۰",
      isPublic: item.isPublic !== false,
      featured: Boolean(item.featured)
    });
  }

  function closeArtistWorkModal() {
    setArtistWorkTagMenuOpen(false);
    setEditingArtistWork(null);
  }

  function clearArtistWorkImage() {
    setEditingArtistWork((prev) => (prev ? { ...prev, image: "" } : prev));
  }

  async function syncArtistPosts() {
    if (typeof onPostsChanged === "function") {
      await onPostsChanged();
    }
    if (createdProfile?.type === "artist") {
      await refreshArtistWorkspace();
    }
  }

  async function saveArtistWork(event) {
    event.preventDefault();
    if (!editingArtistWork) return;
    const title = String(editingArtistWork.title || "").trim();
    const tag = String(editingArtistWork.tag || "").trim();
    const image = String(editingArtistWork.image || "").trim();
    if (!title || !tag) {
      notify("عنوان و دسته لازم است.");
      return;
    }
    if (!image) {
      notify("تصویر نمونه‌کار لازم است.");
      return;
    }
    const body = {
      title,
      tag,
      caption: String(editingArtistWork.caption || "").trim(),
      // Only a freshly picked/cropped picture is sent. An unchanged one is just its media
      // URL, and echoing that back used to overwrite the stored image.
      ...(image.startsWith("data:") ? { image } : {}),
      isPublic: editingArtistWork.isPublic !== false,
      featured: Boolean(editingArtistWork.featured)
    };
    if (artistWorkSaving) return;
    setArtistWorkSaving(true);
    try {
      const isNew = String(editingArtistWork.id).startsWith("new-") || editingArtistWork.id === "new";
      const { ok, payload } = isNew
        ? await createPost(body)
        : await updatePost(editingArtistWork.id, body);
      if (!ok) {
        notify(payload.error || "ذخیره نمونه‌کار انجام نشد.");
        return;
      }
      // The API already returned the saved post: put it in the gallery and close
      // the sheet right away, then refresh the workspace in the background
      // instead of making the user wait for those two extra round trips.
      const saved = mapPortfolioItem(payload.data?.post);
      if (saved) {
        setArtistPortfolioItems((items) => (
          items.some((item) => String(item.id) === String(saved.id))
            ? items.map((item) => (String(item.id) === String(saved.id) ? saved : item))
            : [saved, ...items]
        ));
      }
      setEditingArtistWork(null);
      notify("نمونه‌کار ذخیره شد.");
      void syncArtistPosts().catch(() => {});
    } catch {
      notify("ذخیره نمونه‌کار انجام نشد.");
    } finally {
      setArtistWorkSaving(false);
    }
  }

  async function deleteArtistWork() {
    if (!editingArtistWork?.id) return;
    if (typeof window !== "undefined" && !window.confirm("این پست از گالری نمونه‌کار حذف شود؟")) {
      return;
    }
    if (artistWorkSaving) return;
    const id = editingArtistWork.id;
    setArtistWorkSaving(true);
    try {
      const { ok, payload } = await deletePost(id);
      if (!ok) {
        notify(payload.error || "حذف انجام نشد.");
        return;
      }
      setArtistPortfolioItems((items) => items.filter((item) => String(item.id) !== String(id)));
      setEditingArtistWork(null);
      setPreviewingArtistWorkId((prev) => (prev === id ? null : prev));
      notify("نمونه‌کار از گالری حذف شد.");
      void syncArtistPosts().catch(() => {});
    } catch {
      notify("حذف انجام نشد.");
    } finally {
      setArtistWorkSaving(false);
    }
  }

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
        shellNotify(payload?.error || "تایید نوبت انجام نشد.");
        return;
      }
      if (Array.isArray(payload.data?.bookings)) {
        setArtistBookingList(payload.data.bookings.map(mapArtistBooking).filter(Boolean));
      }
      shellNotify("نوبت تایید شد.");
    } catch {
      shellNotify("تایید نوبت انجام نشد؛ دوباره امتحان کن.");
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
        shellNotify(payload?.error || "رد نوبت انجام نشد.");
        return;
      }
      if (Array.isArray(payload.data?.bookings)) {
        setArtistBookingList(payload.data.bookings.map(mapArtistBooking).filter(Boolean));
      }
      shellNotify("نوبت رد شد.");
    } catch {
      shellNotify("رد نوبت انجام نشد؛ دوباره امتحان کن.");
    } finally {
      artistRequestBusyIdRef.current = "";
      setArtistRequestBusyId("");
    }
  }, [shellNotify]);

  async function respondArtistSalonInvite(inviteId, status) {
    if (!inviteId || artistInviteRespondBusyId) return;
    setArtistInviteRespondBusyId(String(inviteId));
    try {
      const { ok, payload } = await respondArtistInvite({ id: inviteId, status });
      if (!ok) {
        shellNotify(payload.error || "پاسخ به دعوت انجام نشد.");
        return;
      }
      setArtistSalonInviteList(payload.data?.invites || []);
      if (status === "تایید شد") {
        const teamsRes = await getArtistTeams();
        if (teamsRes.ok) setArtistTeams(teamsRes.data?.teams || []);
      }
      shellNotify(status === "تایید شد"
        ? "دعوت سالن پذیرفته شد و به پرسنل اضافه شدی."
        : "دعوت سالن رد شد.");
    } catch {
      shellNotify("پاسخ به دعوت انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setArtistInviteRespondBusyId("");
    }
  }

  async function leaveArtistSalonTeam(salonUserId) {
    if (!salonUserId || artistTeamBusyId) return;
    if (typeof window !== "undefined" && !window.confirm("از این تیم خارج می‌شوی و دیگر در برنامه‌ی سالن نیستی. ادامه؟")) return;
    setArtistTeamBusyId(String(salonUserId));
    try {
      const { ok, payload } = await leaveArtistTeam({ salonUserId });
      if (!ok) {
        shellNotify(payload?.error || "خروج از تیم انجام نشد.");
        return;
      }
      setArtistTeams(payload.data?.teams || []);
      shellNotify("از تیم خارج شدی.");
    } catch {
      shellNotify("خروج از تیم انجام نشد؛ دوباره امتحان کن.");
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
    artistBookingSubmitting,
    artistRequestBusyId,
    confirmArtistBookingRequest,
    declineArtistBookingRequest,
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
    artistBookingSettings,
    setArtistBookingSettings,
    artistBookingSelectedDay,
    setArtistBookingSelectedDay,
    artistHoursList,
    artistHoursOpen,
    setArtistHoursOpen,
    selectedArtistHourDay,
    setSelectedArtistHourDay,
    artistHoursPresets,
    activeArtistHoursPreset,
    activeArtistHoursPresetMeta,
    selectedArtistHour,
    artistHourTimeOptions,
    openArtistHoursDaysCount: activeArtistHours.length,
    weeklyArtistCapacityTotal,
    updateArtistHour,
    updateArtistHoursPreset,
    copyArtistHourToOpenDays,
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
    handleArtistBookingCreate,
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
