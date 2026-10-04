"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { PageIcon } from "../../components/PageIcon";
import { createPortal } from "react-dom";
import {
  BellRing,
  Bookmark,
  CalendarClock,
  Check,
  Crop,
  Eye,
  MapPin,
  Palette,
  Pencil,
  Search,
  Settings,
  ShieldCheck,
  TimerOff,
  Truck,
  Upload,
  UserRound,
  Percent,
  X
} from "lucide-react";
import { BookingSelect } from "../../components/BookingSelect";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";
import {
  buildClockOptions,
  buildUpcomingWeekDays,
  getTodayPersianWeekday,
  parseServiceDurationMinutes,
  SALON_HOUR_TIME_OPTIONS,
  timeLabelToMinutes,
  toIsoLikeTimestamp
} from "../../shared/lib/time";
import {
  formatRelativeBookingDayLabel,
  isPersianDateKey
} from "../../shared/lib/persianCalendar";
import {
  profileRoleMeta,
  salonArtistRoleOptions
} from "../../shared/constants/roles";
import {
  ArtistBreakEditorModal,
  ArtistCollabBoard,
  ArtistOverviewReviews,
  ArtistServicesPanel,
  ArtistWorkPreviewModal,
  PublicArtistModal,
  buildExactBookingDateTabs,
  buildExactBookingDateTabsCentered,
  getBookingDateKey,
  getBookingDateOffsetDays,
  isArtistBookingOnExactDate,
  isArtistBookingOnSelectedDay,
  useArtistWorkspace,
  usePublicArtistProfile
} from "../artist";
import {
  AuthGateForms,
  createLogoutUiGapResets,
  normalizeProfile,
  useAuthSession
} from "../auth";
import {
  PostPreviewModal,
  mapSharedPost,
  usePostActivity
} from "../posts";
import { SettingsPage } from "../settings";
import { useAppSounds } from "./useAppSounds";
import { ClientBookingTracker } from "../client/ClientBookingTracker";
import { preloadImages, thumbUrl } from "../../shared/lib/mediaUrl";
import {
  ClientBookingSettingsModal,
  ClientBookingsPanel,
  ClientProfileOverview
} from "../client";
import { getSaves } from "../../shared/api/saves";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";
import { ProfileGallery } from "../profile/ProfileGallery";
import { ProfileHero } from "../profile/ProfileHero";
import { ProfileHeroWeekStrip } from "../profile/ProfileHeroWeekStrip";
import { ProfileModeRail } from "../profile/ProfileModeRail";
import { BookingCreateForm } from "../profile/BookingCreateForm";
import { BookingSheet } from "../profile/BookingSheet";
import {
  normalizeArtistScheduleBooking,
  normalizeSalonScheduleBooking,
  withScheduleTimeline
} from "../profile/ScheduleRow";
import { ProfileSavedPosts } from "../profile/ProfileSavedPosts";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceComposerModal } from "../profile/ServiceComposerModal";
import {
  buildBookingCustomers,
  SalonClientBookingModal,
  SalonClientPage,
  SalonCustomersPage,
  SalonNearbyInviteSheet,
  SalonServicesWorkspace,
  SalonStaffProfileModal,
  SalonStaffWorkspace,
  SalonToolSheets,
  useSalonDirectory,
  useSalonWorkspace,
  getVisibleSalonServiceItems,
  computeStaffStats
} from "../salons";
import {
  ArtistScheduleBoard,
  SalonScheduleDashboard,
  ScheduleBookingMenuModal
} from "../schedule";
import { AuthBootScreen } from "./AuthBootScreen";
import { NetworkBusyBar } from "../../components/NetworkBusyBar";

import { BottomNav } from "./BottomNav";
import { ClientProfileModal } from "./ClientProfileModal";
import { MobileFloatingCta } from "./MobileFloatingCta";
import { useBookingCreateSheet } from "./useBookingCreateSheet";
import { useProfileEditor } from "./useProfileEditor";
import { useScheduleBookingMenu } from "./useScheduleBookingMenu";
import { useServiceComposer } from "./useServiceComposer";
import { SERVICE_CATALOG } from "../../shared/constants/serviceCatalog";
import { ProfileEditModal } from "./ProfileEditModal";
import {
  initialArtistBookings,
  initialArtistPortfolioItems,
  initialArtistServices,
  profileBoards,
  salonAppointments,
  salonDetailPortfolio,
  salonDetailTeam,
  salonInventory,
  salonServices,
  salonStaff,
  salonTasks
} from "./mockData";

function isWithinLastHours(timestamp, hours) {
  const isoLike = toIsoLikeTimestamp(timestamp);
  if (!isoLike) return false;
  const ms = Date.parse(isoLike);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= hours * 3600 * 1000;
}

// PushManager needs the VAPID public key as a raw Uint8Array, not the
// base64url string it's distributed as — standard conversion, same one
// every Web Push how-to uses (there's no browser-native helper for it).
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

/**
 * Best-effort push opt-in, called once per authenticated session (see
 * onAuthenticated below). Silently does nothing when: push isn't supported
 * (SSR, unsupported browser), the server hasn't configured VAPID keys yet
 * (see .env.example), permission was already denied (re-prompting a denied
 * permission is a browser no-op anyway, but skip the API round-trip), or a
 * subscription already exists (subscribe() on an existing subscription just
 * returns it — this still re-POSTs it, which is fine, saveSubscription
 * upserts by endpoint).
 */
function pushNotificationsSupported() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (typeof Notification === "undefined") return false;
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

async function subscribeToPushNotifications() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return;
  if (typeof Notification !== "undefined" && Notification.permission === "denied") return;

  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription })
    });
  } catch {
    // Best-effort — a failed subscribe attempt must never block or crash
    // the login flow it's piggybacking on.
  }
}

const AUTH_GATE_SPARKLES = [
  { x: 14, y: 16, size: 3, delay: 0 },
  { x: 78, y: 9, size: 2, delay: 1.4 },
  { x: 32, y: 32, size: 2.4, delay: 2.8 },
  { x: 87, y: 27, size: 3.4, delay: 0.6 },
  { x: 8, y: 46, size: 2, delay: 3.6 },
  { x: 62, y: 50, size: 2.8, delay: 1.9 },
  { x: 91, y: 57, size: 2, delay: 4.4 },
  { x: 22, y: 63, size: 3.2, delay: 2.2 },
  { x: 48, y: 20, size: 2, delay: 5 }
];

export function HomeApp() {
  const [activeTab, setActiveTab] = useState("profile");

  // Capture ?join={salonId} from a /join-salon/[id] QR/link redirect (guest
  // branch — see JoinSalonPageClient) before the auth gate renders, so the
  // pending join survives the login/signup round trip. Runs once, first
  // hook in the tree, so it always wins the race against useAuthSession's
  // own mount effect below. useAuthSession's onAuthenticated callback reads
  // this same key once a session exists (login/register/already-booted).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const joinSalonId = new URLSearchParams(window.location.search).get("join");
    if (!joinSalonId) return;
    try {
      window.localStorage.setItem("zibaban_pending_join_salon", joinSalonId);
    } catch {
      // ignore — join just won't auto-fire post-login
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);
  const refreshSavedPostsRef = useRef(null);
  const refreshArtistWorkspaceRef = useRef(null);
  const notifyArtistBookingCreatedRef = useRef(null);
  const applySalonBookingsRef = useRef(null);
  const authCascadeRef = useRef({});
  const [appToast, setAppToast] = useState("");
  const [pushSoftAskVisible, setPushSoftAskVisible] = useState(false);
  const [clientBookingSettings, setClientBookingSettings] = useState(null);
  const [beautyPassport, setBeautyPassport] = useState(null);
  const [followedArtists, setFollowedArtists] = useState([]);
  // Full card data for the "ذخیره‌شده‌ها" (saved) profile tab — from
  // GET /api/saves, refreshed alongside follows (see refreshSaves below).
  // savedSalonKeys/savedArtists (id-only, for button state) live in
  // useSalonDirectory / usePublicArtistProfile respectively and are seeded
  // from the same response's savedTargetIds.
  const [savedProfiles, setSavedProfiles] = useState({ salons: [], artists: [] });
  const [scheduleViewDay, setScheduleViewDay] = useState("");
  const [salonWeekHistoryOpen, setSalonWeekHistoryOpen] = useState(false);
  const [scheduleNow, setScheduleNow] = useState(() => new Date());

  // Fires from useAuthSession's onAuthenticated below (boot/login/register —
  // covers an artist who was already logged in when they opened the
  // /join-salon/[id] link too, not just the guest→signup round trip).
  async function tryJoinPendingSalon(profile) {
    if (profile?.type !== "artist" || typeof window === "undefined") return;
    let pendingSalonId = "";
    try {
      pendingSalonId = window.localStorage.getItem("zibaban_pending_join_salon") || "";
    } catch {
      return;
    }
    if (!pendingSalonId) return;
    try {
      window.localStorage.removeItem("zibaban_pending_join_salon");
    } catch {
      // ignore
    }
    try {
      const response = await fetch("/api/artist/join-salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salonUserId: Number(pendingSalonId) })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setAppToast(`به تیم «${payload?.data?.salon?.name || "سالن"}» پیوستی!`);
      } else if (payload?.code !== "ALREADY_STAFF") {
        setAppToast(payload?.error || "پیوستن به تیم سالن انجام نشد.");
      }
    } catch {
      setAppToast("پیوستن به تیم سالن انجام نشد.");
    }
  }

  const {
    authChecked,
    createdProfile,
    setCreatedProfile,
    profileType,
    setProfileType,
    profileView,
    setProfileView,
    authMode,
    setAuthMode,
    signupStep,
    setSignupStep,
    authNotice,
    setAuthNotice,
    authBusy,
    sessionLockedRef,
    lockSession,
    writeAuthSession,
    handleLoginSubmit,
    handleProfileSubmit,
    logoutAccount,
    deleteAccountPermanently
  } = useAuthSession({
    onEnterTab: setActiveTab,
    onShellNotice: setAppToast,
    onPublicBoot: async ({ isStale, salonsPayload }) => {
      const c = authCascadeRef.current;
      void c.refreshSavedPosts?.();
      if (isStale()) return;
      c.setSalonDirectory?.(salonsPayload?.salons || salonsPayload?.data?.salons || []);
    },
    onGuestBoot: async () => {
      const c = authCascadeRef.current;
      setBeautyPassport(null);
    },
    onAuthenticated: async (profile, { source, isStale }) => {
      const c = authCascadeRef.current;
      if (source === "login") {
        // salonDirectory is already populated from the boot-time guest
        // fetch (onPublicBoot below) -- GET /api/salons is unauthenticated
        // and returns the exact same public, viewer-independent data
        // whether or not anyone is logged in, so re-fetching it again here
        // on every login was pure duplicate work. These three don't depend
        // on each other, so run them together instead of one after another.
        const [, , , passportPayload] = await Promise.all([
          c.refreshSavedPosts?.(),
          c.refreshFollows?.(),
          c.refreshSaves?.(),
          fetch("/api/beauty-passport")
            .then((response) => (response.ok ? response.json() : {}))
            .catch(() => ({}))
        ]);
        setBeautyPassport(passportPayload.passport || passportPayload.data?.passport || null);
      } else if (source === "register") {
        await Promise.all([c.refreshSavedPosts?.(), c.refreshFollows?.(), c.refreshSaves?.()]);
      } else if (source === "boot") {
        const [passportPayload] = await Promise.all([
          fetch("/api/beauty-passport").then((response) => (response.ok ? response.json() : {})).catch(() => ({})),
          c.refreshFollows?.(),
          c.refreshSaves?.()
        ]);
        if (isStale?.()) return;
        setBeautyPassport(passportPayload.passport || passportPayload.data?.passport || null);
      }

      if (profile?.type === "salon") await c.refreshSalonSystemData?.();
      if (profile?.type === "artist") {
        await c.refreshArtistWorkspace?.();
        await tryJoinPendingSalon(profile);
      }
      if (source === "boot" && profile?.type === "client") await c.refreshClientBookings?.();
      // Real push notifications (see app/lib/push.js) so a salon/artist/client
      // finds out about a new/expired request even when the app isn't open.
      // Only auto-(re)subscribe silently when permission is already granted;
      // a cold Notification.requestPermission() with zero context is a
      // reliable way to get a reflexive "Block" (and a denied permission can
      // never be re-prompted per the browser spec), so a fresh "default"
      // permission instead shows an in-app soft-ask banner that explains why
      // before the real browser prompt fires — see pushSoftAskVisible below.
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        void subscribeToPushNotifications();
      } else if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default" &&
        pushNotificationsSupported() &&
        !window.localStorage.getItem("zibaban_push_soft_ask_dismissed")
      ) {
        setPushSoftAskVisible(true);
      }
    },
    onLoggedOut: async () => {
      const c = authCascadeRef.current;
      c.resetPostActivity?.();
      c.resetSalonClient?.();
      c.resetPublicArtistProfile?.();
      c.resetArtistWorkspace?.();
      c.resetSalonWorkspace?.();
      setFollowedArtists([]);
      c.setSavedArtists?.([]);
      setSavedProfiles({ salons: [], artists: [] });
      setBeautyPassport(null);
      setProfileEditOpen(false);
      setProfileEditAvatar("");
      resetLogoutUiGaps();
      await c.refreshSavedPosts?.();
    }
  });

  const {
    selectedPost,
    setSelectedPost,
    openPost,
    savedPosts,
    selectedPostIsSaved,
    savedPostTitles,
    recordPostView,
    refreshSavedPosts,
    resetPostActivity,
    toggleSavedPost,
    sharePost
  } = usePostActivity({
    createdProfile,
    onNotice: setAppToast
  });

  refreshSavedPostsRef.current = refreshSavedPosts;

  const {
    salonDirectory,
    setSalonDirectory,
    salonDirectoryLoading,
    selectedSalon,
    setSelectedSalon,
    followedSalons,
    setFollowedSalons,
    savedSalonKeys,
    setSavedSalonKeys,
    salonClientTab,
    setSalonClientTab,
    salonClientBooking,
    salonClientBookingBusy,
    clientBookingList,
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
    confirmSalonClientBooking
  } = useSalonDirectory({
    createdProfile,
    onNotice: setAppToast,
    onShellNotice: setAppToast,
    onOwnerBookingsSync: (bookings) => applySalonBookingsRef.current?.(bookings, { bump: true }),
    onLinkedArtistBooked: (id) => notifyArtistBookingCreatedRef.current?.(id)
  });

  // Clients don't have a real-time "seen" flag from the server, so we track
  // which booking statuses the client has already looked at locally: a
  // {bookingId: status} snapshot in localStorage, scoped per account. A
  // booking counts as "unseen" when its current status differs from the
  // last snapshot taken (covers both "never seen this booking" and "status
  // changed since I last opened the panel"), for the 3 statuses worth
  // surfacing a notification for (pending doesn't need one — it's expected).
  const clientSeenStorageKey = createdProfile?.type === "client" && createdProfile?.id
    ? `zibaban_client_seen_bookings_${createdProfile.id}`
    : "";
  const unseenClientBookingCount = useMemo(() => {
    if (!clientSeenStorageKey || typeof window === "undefined") return 0;
    let seenMap = {};
    try {
      seenMap = JSON.parse(window.localStorage.getItem(clientSeenStorageKey) || "{}");
    } catch {
      seenMap = {};
    }
    return clientBookingList.filter((booking) => {
      const status = booking.status || "";
      if (!["تایید شده", "لغو", "منقضی شده"].includes(status)) return false;
      return seenMap[booking.id] !== status;
    }).length;
  }, [clientBookingList, clientSeenStorageKey]);

  function markClientBookingsSeen() {
    if (!clientSeenStorageKey || typeof window === "undefined") return;
    const seenMap = {};
    clientBookingList.forEach((booking) => {
      if (booking.id != null) seenMap[booking.id] = booking.status || "";
    });
    try {
      window.localStorage.setItem(clientSeenStorageKey, JSON.stringify(seenMap));
    } catch {
      // best-effort only
    }
  }

  const {
    artistSocialStats,
    artistSalonInviteList,
    artistInviteRespondBusyId,
    artistWorkSaving,
    artistTeams,
    artistTeamBusyId,
    leaveArtistSalonTeam,
    artistBookingSubmitting,
    artistRequestBusyId,
    confirmArtistBookingRequest,
    declineArtistBookingRequest,
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
    setArtistBookingCreateOpen,
    artistCollabOffers,
    setArtistCollabOffers,
    artistCollabDraft,
    setArtistCollabDraft,
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
    openArtistHoursDaysCount,
    weeklyArtistCapacityTotal,
    updateArtistHour,
    updateArtistHoursPreset,
    copyArtistHourToOpenDays,
    visibleArtistPortfolio,
    artistGalleryTags,
    artistGalleryItems,
    previewingArtistWork,
    artistWorkTagOptions,
    artistBookingWeekTabs,
    artistScheduleDayLabel,
    pendingArtistSalonInvites,
    artistUnreadNoticeCount,
    refreshArtistWorkspace,
    notifyArtistBookingCreated,
    resetArtistWorkspace,
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
    respondArtistSalonInvite,
    artistWorkspaceLoading
  } = useArtistWorkspace({
    createdProfile,
    activeTab,
    salonDirectory,
    onNotice: setAppToast,
    onShellNotice: setAppToast,
    onPostsChanged: () => refreshSavedPostsRef.current?.(),
    onCloseBookingSheet: () => {
      setBookingSheetOpen(false);
      setBookingSelectMenu("");
    }
  });
  refreshArtistWorkspaceRef.current = refreshArtistWorkspace;
  notifyArtistBookingCreatedRef.current = notifyArtistBookingCreated;

  const {
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
    openSalonWorkspace: openSalonWorkspaceFromHook,
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
    resetSalonWorkspace,
    salonWorkspaceLoading
  } = useSalonWorkspace({
    createdProfile,
    onNotice: setAppToast,
    onShellNotice: setAppToast,
    onPostsChanged: () => refreshSavedPostsRef.current?.(),
    onScheduleViewDay: setScheduleViewDay,
    onCloseBookingSheet: () => {
      setBookingSheetOpen(false);
      setBookingSelectMenu("");
    },
    onLinkedArtistBooked: (id) => notifyArtistBookingCreatedRef.current?.(id),
    onArtistCollabOffersPatch: setArtistCollabOffers,
    onSalonDirectorySync: setSalonDirectory,
    onSelectedSalonSync: setSelectedSalon,
    onBookingDefaults: ({ staffName, serviceName, date }) => {
      if (staffName) setBookingStaffName((current) => current || staffName);
      if (serviceName) setBookingServiceName((current) => current || serviceName);
      if (date) setBookingDate((current) => current || date);
    }
  });
  applySalonBookingsRef.current = applySalonBookings;

  const {
    profileEditOpen,
    setProfileEditOpen,
    profileEditAvatar,
    setProfileEditAvatar,
    profileLocationSaving,
    profileSettings,
    updateRegisteredProfile,
    profileSaving,
    saveProfileLocation,
    openProfileEdit,
    handleProfileAvatarUpload,
    toggleProfileSetting,
    logoSaving,
    posterSaving,
    saveProfileLogo,
    saveProfilePoster,
    removeProfileLogo,
    removeProfilePoster,
    saveAvatarPosition,
    savePosterPosition,
    pendingAvatarUpload,
    pendingPosterUpload,
    confirmAvatarUpload,
    confirmPosterUpload,
    cancelAvatarUpload,
    cancelPosterUpload
  } = useProfileEditor({
    createdProfile,
    setCreatedProfile,
    setProfileType,
    setProfileView,
    setActiveTab,
    lockSession,
    writeAuthSession,
    onNotice: setAppToast
  });

  function openSalonWorkspace(tool) {
    setProfileView("overview");
    openSalonWorkspaceFromHook(tool);
  }

  const {
    selectedPublicArtist,
    setSelectedPublicArtist,
    publicArtistView,
    setPublicArtistView,
    publicArtistGalleryFilter,
    setPublicArtistGalleryFilter,
    publicArtistBookingDay,
    setPublicArtistBookingDay,
    publicArtistBookingSlot,
    setPublicArtistBookingSlot,
    publicArtistSelectedServiceId,
    publicArtistBookingBusy,
    publicArtistPortfolio,
    publicArtistGalleryTags,
    publicArtistFeatured,
    publicArtistGalleryRest,
    publicArtistServices,
    isFollowingPublicArtist,
    isSavedPublicArtist,
    setSavedArtists,
    publicArtistHeroImage,
    openPublicArtistProfile,
    closePublicArtistProfile,
    confirmPublicArtistBooking,
    toggleFollowPublicArtist,
    toggleSavePublicArtist,
    shareArtistProfile,
    openPublicArtistWork,
    selectPublicArtistService,
    resetPublicArtistProfile
  } = usePublicArtistProfile({
    createdProfile,
    followedArtists,
    setFollowedArtists,
    setFollowedSalons,
    onNotice: setAppToast,
    onSelectPost: openPost,
    onBeforeOpen: () => {
      setSelectedArtistProfile(null);
      setSelectedSalon(null);
    },
    onArtistBookingCreated: notifyArtistBookingCreated
  });

  const {
    artistServiceCreateOpen,
    setArtistServiceCreateOpen,
    artistServiceCreateMode,
    setArtistServiceCreateMode,
    artistServiceDraft,
    setArtistServiceDraft,
    addArtistService,
    addArtistServicePreset,
    customizeServicePreset,
    openArtistServiceCreate,
    openSalonServiceCreate,
    closeArtistServiceCreate,
    editArtistService
  } = useServiceComposer({
    createdProfile,
    artistServiceList,
    salonServiceList,
    upsertArtistOwnerService,
    upsertSalonOwnerService,
    onNotice: setAppToast
  });

  const {
    scheduleBookingMenu,
    setScheduleBookingMenu,
    scheduleBookingView,
    setScheduleBookingView,
    openScheduleBookingMenu,
    closeScheduleBookingMenu,
    changeScheduleBookingTime,
    changeScheduleBookingStaff,
    cancelScheduleBooking
  } = useScheduleBookingMenu({
    artistBookingList,
    salonAppointmentList,
    setSelectedBookingClient,
    patchSalonAppointment
  });

  const activeRoleMeta = profileRoleMeta[profileType] || profileRoleMeta.client;
  const activeCreatedMeta = createdProfile ? (profileRoleMeta[createdProfile.type] || profileRoleMeta.client) : null;

  // Post categories are exactly the services on this owner's menu.
  const salonWorkTagOptions = useMemo(
    () => Array.from(new Set(salonServiceList.map((item) => String(item.name || "").trim()).filter(Boolean))),
    [salonServiceList]
  );

  // Centered on today (3 days back, today, 3 days forward) rather than
  // today-forward-only, so the salon hero week strip can scroll both
  // directions with today in the middle. Kept to a single 7-day span so
  // weekday names (used as the select key elsewhere below) stay unique.
  const salonScheduleWeekTabs = useMemo(() => buildExactBookingDateTabsCentered(3, 3), []);

  const selectedSalonStaff = useMemo(() => {
    return safeSalonStaffList.find((person) => person.name === selectedStaffName) || safeSalonStaffList[0] || null;
  }, [safeSalonStaffList, selectedStaffName]);

  const selectedStaffAppointments = useMemo(() => {
    if (!selectedSalonStaff) return [];
    return salonAppointmentList.filter((item) => item.staff === selectedSalonStaff.name);
  }, [salonAppointmentList, selectedSalonStaff]);

  const activeStaffCount = useMemo(() => {
    return safeSalonStaffList.filter((person) => person.state !== "مرخصی").length;
  }, [safeSalonStaffList]);

  const salonDynamicMetrics = useMemo(() => ([
    { label: "رزرو", value: salonAppointmentList.length, hint: "از دیتابیس" },
    { label: "پرسنل", value: safeSalonStaffList.length, hint: "عضو فعال" },
    { label: "خدمات", value: salonServiceList.length, hint: "منوی واقعی" },
    { label: "همکاری", value: salonCollabRequestList.filter((item) => item.status === "آماده ارسال").length, hint: "پیشنهاد" }
  ]), [salonAppointmentList.length, safeSalonStaffList.length, salonServiceList.length, salonCollabRequestList]);

  const salonSocialStats = useMemo(() => {
    const ownSalon = salonDirectory.find((salon) => (
      String(salon.id) === String(createdProfile?.id)
      || String(salon.source_key) === String(createdProfile?.id)
      || salon.name === createdProfile?.data?.name
    ));
    return {
      followers: Number(ownSalon?.follower_count ?? ownSalon?.followerCount ?? createdProfile?.data?.follower_count ?? 0),
      following: Number(ownSalon?.following_count ?? ownSalon?.followingCount ?? createdProfile?.data?.following_count ?? 0),
      posts: salonPortfolioList.length
    };
  }, [salonDirectory, createdProfile, salonPortfolioList.length]);

  const activeServiceManagerList = createdProfile?.type === "salon" ? salonServiceList : artistServiceList;

  const activeSalonHours = salonHoursList.filter((hour) => hour.active);

  const {
    bookingSheetOpen,
    setBookingSheetOpen,
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
    artistBookingDayOptions,
    artistBookingDateForSlots,
    artistBookingFreeSlots,
    selectedArtistService,
    openBookingSheet,
    closeBookingSheet
  } = useBookingCreateSheet({
    createdProfile,
    safeSalonStaffList,
    salonServiceList,
    artistServiceList,
    salonAppointmentList,
    salonScheduleWeekTabs,
    activeSalonHours,
    artistBookingList,
    artistBreakTime,
    salonWorkspace,
    salonToolSheetOpen,
    salonTool,
    setActiveTab,
    setArtistBookingRailOpen,
    setArtistBookingCreateOpen,
    setSalonHeroSheet,
    setSalonToolSheetOpen,
    setSalonWorkspace
  });

  const resetLogoutUiGaps = createLogoutUiGapResets({
    setBookingSheetOpen,
    setScheduleBookingMenu,
    setScheduleBookingView,
    setClientBookingSettings,
    setArtistServiceCreateOpen,
    setArtistServiceCreateMode,
    setArtistServiceDraft,
    setBookingStaffName,
    setBookingServiceName,
    setBookingDate,
    setBookingTime,
    setBookingSelectMenu
  });

  const salonHoursPresets = [
    { id: "standard", label: "معمولی", detail: "شنبه تا چهارشنبه · ۱۰ تا ۲۰ · ظرفیت ۸" },
    { id: "extended", label: "پرفشار", detail: "همه روزها باز · ۱۰ تا ۲۲ · ظرفیت ۱۲" },
    { id: "weekend", label: "آخر هفته", detail: "پنجشنبه و جمعه · ۱۲ تا ۱۸ · ظرفیت ۵" }
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
  // reviewed; "لغو" (cancelled) never counts as pending.
  const pendingArtistBookingRequests = useMemo(() => (
    artistBookingList.filter((item) => item.status === "تازه" || item.status === "درخواست")
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

function getPassportMatch(post) {
    if (!beautyPassport?.active) return null;
    const scores = {
      "ناخن": "۹۲٪",
      "مو": "۸۸٪",
      "میکاپ": "۹۰٪",
      "ابرو": "۸۶٪",
      "پوست": "۸۴٪",
      "صورت": "۸۷٪",
      "عروس": "۸۳٪"
    };
    return scores[post.tag] || "۸۵٪";
  }

  function getPortfolioCardStyle(item) {
    return item.image
      ? { backgroundImage: `linear-gradient(180deg, rgba(12, 14, 16, 0.04) 0%, transparent 46%, rgba(12, 14, 16, 0.68) 100%), url("${item.image}")` }
      : { backgroundImage: `url("/gallery-tile-empty.webp")` };
  }


  async function refreshFollows() {
    try {
      const response = await fetch("/api/follows");
      if (!response.ok) return;
      const payload = await response.json();
      const ids = (payload.data?.followingIds || []).map(String);
      setFollowedArtists(ids);
      setFollowedSalons(ids);
    } catch {
      // ignore
    }
  }

  // Seeds real saved-salon/saved-artist state from the server — mirrors
  // refreshFollows above (same "one id list feeds both salon + artist local
  // state" shape, since a save target can be either type). Also stashes the
  // full card arrays for the "ذخیره‌شده‌ها" profile tab so it doesn't have to
  // derive from whatever's currently loaded in salonDirectory.
  async function refreshSaves() {
    try {
      const { ok, data } = await getSaves();
      if (!ok) return;
      const ids = (data?.savedTargetIds || []).map(String);
      setSavedSalonKeys(ids);
      setSavedArtists(ids);
      setSavedProfiles({ salons: data?.salons || [], artists: data?.artists || [] });
    } catch {
      // ignore
    }
  }

  // toggleSaveSalon/toggleSavePublicArtist only update the id-only
  // savedSalonKeys/savedArtists lists (for button state elsewhere) — they
  // don't know about savedProfiles' full card arrays, which only the
  // "ذخیره‌شده‌ها" tab renders. Without this, removing a card from that tab
  // toggled the DB correctly but left the stale card on screen until the
  // next full refreshSaves() (e.g. a reload) — DB and UI silently diverged.
  function removeSavedSalon(salon) {
    toggleSaveSalon(salon);
    const key = String(salon.id || salon.source_key || salon.name);
    setSavedProfiles((prev) => ({
      ...prev,
      salons: prev.salons.filter((item) => String(item.id || item.source_key || item.name) !== key)
    }));
  }

  function removeSavedArtist(artist) {
    toggleSavePublicArtist(artist);
    const key = String(artist.id || artist.name);
    setSavedProfiles((prev) => ({
      ...prev,
      artists: prev.artists.filter((item) => String(item.id || item.name) !== key)
    }));
  }

  authCascadeRef.current = {
    refreshSavedPosts,
    setSalonDirectory,
    refreshFollows,
    refreshSaves,
    refreshSalonSystemData,
    refreshArtistWorkspace,
    refreshClientBookings,
    resetPostActivity,
    resetSalonClient,
    resetPublicArtistProfile,
    resetArtistWorkspace,
    resetSalonWorkspace,
    setSavedArtists
  };

  useEffect(() => {
    if (createdProfile?.type !== "salon" && createdProfile?.type !== "artist") return undefined;
    setScheduleNow(new Date());
    const timer = window.setInterval(() => setScheduleNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, [createdProfile?.type]);

  useEffect(() => {
    if (!appToast) return undefined;
    const timer = window.setTimeout(() => setAppToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [appToast]);



  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const resetPageScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelectorAll(".workspace, .contentGrid, .mobilePage.is-active, .profilePanel.is-active, .salonPanel.is-active, .feedPanel.is-active").forEach((node) => {
        node.scrollTop = 0;
      });
    };
    resetPageScroll();
    const frame = window.requestAnimationFrame(resetPageScroll);
    const timer = window.setTimeout(resetPageScroll, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [
    activeTab,
    profileView,
    salonTool,
    salonWorkspace,
    selectedSalon?.id,
    selectedSalon?.source_key,
    selectedPublicArtist?.id
  ]);

  function goToTab(tab) {
    if (!createdProfile) {
      setActiveTab("profile");
      return;
    }
    setActiveTab(tab);
  }

  function resolvePostOwner(post) {
    if (!post) return null;
    const fromDirectory = salonDirectory.find((salon) => (
      salon.name === post.salon
      || String(salon.id) === String(post.ownerUserId)
      || String(salon.source_key) === String(post.ownerUserId)
    ));
    const isOwnPost = Boolean(
      createdProfile
      && (createdProfile.type === "artist" || createdProfile.type === "salon")
      && (
        String(post.ownerUserId) === String(createdProfile.id)
        || createdProfile.data?.name === post.salon
      )
    );

    if (isOwnPost) {
      return {
        id: createdProfile.id,
        name: createdProfile.data.name,
        area: createdProfile.data.area || post.area || "",
        role: createdProfile.data.service || post.tag || (createdProfile.type === "salon" ? "سالن زیبایی" : "آرتیست"),
        bio: createdProfile.data.bio || post.meta || "",
        source: createdProfile.type === "salon"
          ? (fromDirectory || null)
          : createdProfile,
        kind: "self",
        entityType: createdProfile.type
      };
    }

    if (post.ownerType === "salon" || fromDirectory) {
      return {
        id: fromDirectory?.id || post.ownerUserId,
        name: fromDirectory?.name || post.salon || "سالن",
        area: fromDirectory?.area || post.area || "",
        role: fromDirectory?.tag || post.tag || "سالن زیبایی",
        bio: fromDirectory?.bio || post.meta || "",
        source: fromDirectory || null,
        kind: "salon",
        entityType: "salon"
      };
    }

    return {
      id: post.ownerUserId,
      name: post.salon || "آرتیست",
      area: post.area || "",
      role: post.ownerService ? `آرتیست ${post.ownerService}` : (post.tag || "آرتیست"),
      bio: post.ownerBio || post.meta || "",
      source: null,
      kind: "artist",
      entityType: "artist"
    };
  }

  function buildOwnPublicSalon() {
    const fromDirectory = salonDirectory.find((salon) => (
      String(salon.id) === String(createdProfile?.id)
      || String(salon.source_key) === String(createdProfile?.id)
      || salon.name === createdProfile?.data?.name
    ));
    if (fromDirectory) {
      return {
        ...fromDirectory,
        portfolio: fromDirectory.portfolio?.length ? fromDirectory.portfolio : salonPortfolioList,
        staff: fromDirectory.staff?.length ? fromDirectory.staff : salonStaffList,
        services: fromDirectory.services?.length ? fromDirectory.services : salonServiceList
      };
    }
    if (createdProfile?.type !== "salon") return null;
    return {
      id: createdProfile.id,
      source_key: String(createdProfile.id),
      name: createdProfile.data?.name || "سالن",
      area: createdProfile.data?.area || "",
      tag: createdProfile.data?.tag || createdProfile.data?.service || "سالن زیبایی",
      open: createdProfile.data?.open || "امروز",
      bio: createdProfile.data?.bio || "",
      avatar: createdProfile.data?.avatar || "",
      post_count: salonPortfolioList.length,
      follower_count: Number(createdProfile.data?.follower_count || 0),
      following_count: Number(createdProfile.data?.following_count || 0),
      portfolio: salonPortfolioList,
      staff: salonStaffList,
      services: salonServiceList
    };
  }

  // Hoisted out of openPostOwnerProfile (below) so it can also be reused
  // as the "رزرو دوباره" (book again) navigation from the client's own
  // bookings/orders activity view — see rebookSalonFromBooking.
  const openSalonProfile = async (salonLike) => {
      closePublicArtistProfile();
      setSalonClientTab("gallery");

      const matchesSalon = (salon) => (
        String(salon.id || "") === String(salonLike.id || "")
        || String(salon.source_key || "") === String(salonLike.id || "")
        || String(salon.id || "") === String(salonLike.source_key || "")
        || salon.name === salonLike.name
      );
      const fallbackSalon = salonLike.source || {
        id: salonLike.id,
        source_key: salonLike.source_key || String(salonLike.id || ""),
        name: salonLike.name,
        area: salonLike.area,
        tag: salonLike.role || salonLike.tag,
        open: salonLike.open || "امروز",
        bio: salonLike.bio || "",
        avatar: salonLike.avatar || "",
        post_count: salonLike.post_count || 0,
        follower_count: salonLike.follower_count || 0,
        following_count: salonLike.following_count || 0,
        portfolio: salonLike.portfolio || [],
        services: salonLike.services || [],
        staff: salonLike.staff || []
      };

      // Show the page right away from what we already have, then refine it:
      // the old flow awaited two sequential round trips before anything moved.
      const localSalon = salonDirectory.find(matchesSalon);
      let nextSalon = localSalon || fallbackSalon;
      setSelectedSalon(nextSalon);
      goToTab("salons");

      if (!localSalon) {
        try {
          const response = await fetch("/api/salons");
          if (response.ok) {
            const payload = await response.json();
            const list = payload.salons || payload.data?.salons || [];
            if (list.length) {
              setSalonDirectory(list);
              nextSalon = list.find(matchesSalon) || nextSalon;
            }
          }
        } catch {
          // keep the resolved salon from the current post/directory
        }
      }

      // The list stays light; pull the full detail for the public page.
      if (nextSalon?.id) {
        try {
          const detailResponse = await fetch("/api/salons/" + encodeURIComponent(nextSalon.id));
          if (detailResponse.ok) {
            const detailPayload = await detailResponse.json();
            const detail = detailPayload.data?.salon || detailPayload.salon;
            if (detail && typeof detail === "object") {
              nextSalon = { ...nextSalon, ...detail };
            }
          }
        } catch {
          // keep the resolved salon from the list/directory
        }
      }

      setSelectedSalon(nextSalon);
  };

  // "رزرو دوباره" — reopens the salon a past booking was made with, using the
  // salon fields the booking row already carries (see listClientSalonBookings
  // in app/lib/db/repos/salons/bookings.js: salon_user_id/salonName/etc).
  function rebookSalonFromBooking(booking) {
    if (!booking) return;
    const salonId = booking.salon_user_id || booking.sourceSalonUserId || booking.salonUserId || "";
    if (!salonId) {
      setAppToast("این رزرو به یک حساب سالن وصل نیست.");
      return;
    }
    openSalonProfile({
      id: salonId,
      source_key: String(salonId),
      name: booking.salonName || booking.salon_name || "",
      area: booking.salonArea || booking.salon_area || "",
      avatar: booking.salonAvatar || booking.salon_avatar || ""
    });
  }

  // "رزرو دوباره" for a direct-artist booking (see listClientArtistBookings
  // in app/lib/db/repos/artists.js) — opens the artist's own public
  // profile (PublicArtistModal), not a salon page. The row's name/area/
  // avatar are reused under salonName/salonArea/salonAvatar for display,
  // but the routing id is its own artistUserId/sourceArtistUserId field
  // — never aliased to salon_user_id, so this never gets confused with
  // rebookSalonFromBooking above.
  function rebookArtistFromBooking(booking) {
    if (!booking) return;
    const artistId = booking.artistUserId || booking.sourceArtistUserId || "";
    if (!artistId) {
      setAppToast("این رزرو به یک حساب آرتیست وصل نیست.");
      return;
    }
    openPublicArtistProfile({
      id: artistId,
      name: booking.salonName || booking.salon_name || "",
      area: booking.salonArea || booking.salon_area || "",
      avatar: booking.salonAvatar || booking.salon_avatar || ""
    });
  }

  // Client's own bookings/activity view ("فعالیت من") mixes salon bookings
  // and direct-artist bookings in one list (see refreshClientBookings in
  // useSalonDirectory.js). "رزرو دوباره" on a merged row must route to the
  // right profile type per row, not assume salon — dispatch on
  // bookingSource here rather than in ClientBookingsPanel/
  // ClientBookingSettingsModal (presentational; no data-shape branching there).
  function rebookFromBooking(booking) {
    if (!booking) return;
    if (booking.bookingSource === "artist") {
      rebookArtistFromBooking(booking);
      return;
    }
    rebookSalonFromBooking(booking);
  }

  async function openPostOwnerProfile(post) {
    const artist = resolvePostOwner(post);
    setSelectedPost(null);
    if (!artist) return;

    if (artist.kind === "self" && artist.entityType === "salon") {
      const ownSalon = artist.source || buildOwnPublicSalon();
      if (ownSalon) {
        await openSalonProfile(ownSalon);
        return;
      }
    }

    if (artist.kind === "self" && artist.entityType === "artist") {
      await openPublicArtistProfile({
        ...artist,
        kind: "artist",
        entityType: "artist"
      });
      return;
    }

    if (artist.kind === "self") {
      goToTab("profile");
      return;
    }

    if (artist.kind === "salon") {
      await openSalonProfile(artist);
      return;
    }

    await openPublicArtistProfile(artist);
  }

  function openSalonStaffPublicProfile(person) {
    if (!person) return;
    const artistId = Number(person.artist_user_id || 0) || null;
    if (!artistId && !person.has_artist_profile) {
      setSelectedArtistProfile(person);
      return;
    }
    openPublicArtistProfile({
      id: artistId,
      name: person.artist_name || person.name,
      area: person.artist_area || "",
      role: person.role || person.artist_service || "آرتیست",
      bio: person.artist_bio || person.bio || "",
      avatar: person.avatar || person.staff_avatar || "",
      phone: person.artist_phone || person.phone || "",
      kind: "artist",
      entityType: "artist"
    });
  }

  async function shareSalonOwnerProfile() {
    await shareSalonProfile(createdProfile?.data?.name || "سالن");
  }

  const renderSavedPosts = () => (
    <ProfileSavedPosts
      posts={savedPosts}
      salons={savedProfiles.salons}
      artists={savedProfiles.artists}
      onSelectPost={openPost}
      onRemovePost={(item) => toggleSavedPost(item.title, item)}
      onSelectSalon={selectSalonWithDetail}
      onRemoveSalon={removeSavedSalon}
      onSelectArtist={openPublicArtistProfile}
      onRemoveArtist={removeSavedArtist}
    />
  );

  const [salonPreviewWorkId, setSalonPreviewWorkId] = useState(null);
  const salonPreviewWork = useMemo(
    () => salonPortfolioList.find((item) => String(item.id) === String(salonPreviewWorkId)) || null,
    [salonPortfolioList, salonPreviewWorkId]
  );

  const selectedPostOwner = selectedPost ? resolvePostOwner(selectedPost) : null;

  // Neighbours to browse with the viewer arrows: the saved list when the post came from there.
  const selectedPostSiblings = (() => {
    if (!selectedPost) return [];
    const sameId = (item) => String(item.id) === String(selectedPost.id);
    if (savedPosts.some(sameId)) return savedPosts;
    if (publicArtistPortfolio.some(sameId)) return publicArtistPortfolio;
    return [];
  })();

  const selectSalonWithDetail = async (salon) => {
    if (!salon) return;
    setSalonClientTab("gallery");
    setSelectedSalon(salon);
    try {
      const response = await fetch("/api/salons/" + encodeURIComponent(salon.id));
      if (response.ok) {
        const payload = await response.json();
        const detail = payload.data?.salon || payload.salon;
        if (detail && typeof detail === "object") {
          setSelectedSalon((current) => (
            current && String(current.id) === String(salon.id)
              ? { ...current, ...detail }
              : { ...salon, ...detail }
          ));
          if (typeof detail.isSaved === "boolean") {
            const salonKey = String(salon.id || salon.source_key || salon.name);
            setSavedSalonKeys((items) => {
              if (detail.isSaved) return items.includes(salonKey) ? items : [...items, salonKey];
              return items.includes(salonKey) ? items.filter((item) => item !== salonKey) : items;
            });
          }
        }
      }
    } catch {
      // keep the list row
    }
  };

  const profileModeRail = (
    <ProfileModeRail
      placement="panel"
      profileType={profileType}
      profileView={profileView}
      salonWorkspace={salonWorkspace}
      activeRoleMeta={activeRoleMeta}
      onOverview={() => {
        closeSalonWorkspace();
        setProfileView("overview");
      }}
      onSalonWorkspace={openSalonWorkspace}
      onProfileView={setProfileView}
    />
  );

  // Floats above the bottom nav (same slot the tab rail used to float in) —
  // rendered as a sibling of the animated .mobilePage tree via
  // MobileFloatingCta, not nested inside ProfileHero, because a
  // position:fixed element nested inside .mobilePage.is-active gets trapped
  // by that element's page-transition transform and never reaches the real
  // viewport edge. See MobileFloatingCta.jsx.
  const salonWeekStripFloating = (
    <ProfileHeroWeekStrip
      items={salonHeroWeekTabs}
      selectedDay={activeScheduleDateKey}
      onSelectDay={setScheduleViewDay}
      onOpenHistory={() => setSalonWeekHistoryOpen(true)}
      ariaLabel="برنامه هفته سالن"
    />
  );

  return (
    <main className={`appShell ${!createdProfile ? "is-auth-gate" : ""} ${selectedSalon && activeTab === "salons" ? "is-salon-client" : ""} ${selectedPublicArtist ? "is-artist-public" : ""} ${!authChecked ? "is-auth-loading" : ""}`}>
      <NetworkBusyBar />
      {!authChecked ? <AuthBootScreen /> : null}

      <section className="workspace">
        {!createdProfile ? (
          <div className="authGateBg" aria-hidden="true">
            <div className="authGateAurora">
              <span className="authAuroraBlob authAuroraBlob--gold" />
              <span className="authAuroraBlob authAuroraBlob--blush" />
              <span className="authAuroraBlob authAuroraBlob--teal" />
              {AUTH_GATE_SPARKLES.map((sparkle, index) => (
                <span
                  key={index}
                  className="authAuroraSparkle"
                  style={{
                    left: `${sparkle.x}%`,
                    top: `${sparkle.y}%`,
                    width: `${sparkle.size}px`,
                    height: `${sparkle.size}px`,
                    animationDelay: `${sparkle.delay}s`
                  }}
                />
              ))}
            </div>
            <span className="authGateScrim" />
          </div>
        ) : null}

        <section className="contentGrid">
          <SettingsPage
            active={activeTab === "settings"}
            profile={createdProfile}
            locationSaving={profileLocationSaving}
            onSaveLocation={saveProfileLocation}
            onEditProfile={openProfileEdit}
            logoSaving={logoSaving}
            posterSaving={posterSaving}
            onSaveLogo={saveProfileLogo}
            onSavePoster={saveProfilePoster}
            onRemoveLogo={removeProfileLogo}
            onRemovePoster={removeProfilePoster}
            onNotify={setAppToast}
            onSaveAvatarPosition={saveAvatarPosition}
            onSavePosterPosition={savePosterPosition}
            pendingAvatarUpload={pendingAvatarUpload}
            pendingPosterUpload={pendingPosterUpload}
            onConfirmAvatarUpload={confirmAvatarUpload}
            onConfirmPosterUpload={confirmPosterUpload}
            onCancelAvatarUpload={cancelAvatarUpload}
            onCancelPosterUpload={cancelPosterUpload}
            profileSettings={profileSettings}
            onToggleSetting={toggleProfileSetting}
            artistBookingSettings={artistBookingSettings}
            onArtistBookingChange={setArtistBookingSettings}
            savedPostsCount={savedPosts.length}
            onOpenSaved={() => {
              if (createdProfile?.type === "salon") setSalonHeroSheet("saved");
              else setProfileView("saved");
            }}
            onLogout={logoutAccount}
            onDeleteAccount={deleteAccountPermanently}
            hoursOpen={settingsHoursOpen}
            onToggleHoursOpen={() => setSettingsHoursOpen((open) => !open)}
            hoursPresets={createdProfile?.type === "artist" ? artistHoursPresets : salonHoursPresets}
            activeHoursPresetId={createdProfile?.type === "artist" ? activeArtistHoursPreset : activeHoursPreset}
            activeHoursPresetMeta={createdProfile?.type === "artist" ? activeArtistHoursPresetMeta : activeHoursPresetMeta}
            hoursList={createdProfile?.type === "artist" ? artistHoursList : salonHoursList}
            selectedHour={createdProfile?.type === "artist" ? selectedArtistHour : selectedSalonHour}
            hourTimeOptions={createdProfile?.type === "artist" ? artistHourTimeOptions : salonHourTimeOptions}
            openDaysCount={createdProfile?.type === "artist" ? openArtistHoursDaysCount : activeSalonHours.length}
            weeklyCapacityTotal={createdProfile?.type === "artist" ? weeklyArtistCapacityTotal : weeklyCapacityTotal}
            onSelectHoursPreset={createdProfile?.type === "artist" ? updateArtistHoursPreset : updateSalonHoursPreset}
            onCopyHourToOpenDays={createdProfile?.type === "artist" ? copyArtistHourToOpenDays : copySalonHourToOpenDays}
            onSelectHourDay={createdProfile?.type === "artist" ? setSelectedArtistHourDay : setSelectedSalonHourDay}
            onUpdateHour={createdProfile?.type === "artist" ? updateArtistHour : updateSalonHour}
          />

          {createdProfile?.type === "salon" && (
            <SalonCustomersPage
              active={activeTab === "customers"}
              bookings={salonAppointmentList}
            />
          )}

          {createdProfile?.type === "artist" && (
            <SalonCustomersPage
              active={activeTab === "customers"}
              bookings={artistBookingList}
              ownerLabel="شما"
            />
          )}

          <SalonClientPage
            active={activeTab === "salons"}
            selectedSalon={selectedSalon}
            salons={salonDirectory}
            postActions={{
              isSaved: (post) => savedPostTitles.includes(String(post.id)),
              toggleSave: (post) => toggleSavedPost(post.title, mapSharedPost({
                ...post,
                ownerUserId: selectedSalon?.id,
                ownerType: "salon",
                salon: selectedSalon?.name
              })),
              share: sharePost,
              view: recordPostView
            }}
            directoryLoading={salonDirectoryLoading}
            tab={salonClientTab}
            isFollowing={isFollowingSelectedSalon}
            isSaved={isSavedSelectedSalon}
            getVisibleServices={getVisibleSalonServiceItems}
            getPortfolioCardStyle={getPortfolioCardStyle}
            onBack={() => setSelectedSalon(null)}
            onFollow={toggleFollowSalon}
            onSave={toggleSaveSalon}
            onShare={shareSalonProfile}
            onTabChange={setSalonClientTab}
            onOpenBooking={openSalonClientBooking}
            onSelectSalon={selectSalonWithDetail}
          />
        </section>

        {activeTab === "salons" && (
          <SalonClientBookingModal
            open={Boolean(selectedSalon && salonClientBooking.open)}
            salon={selectedSalon}
            booking={salonClientBooking}
            freeTimes={salonClientFreeTimes}
            busy={salonClientBookingBusy}
            onClose={closeSalonClientBooking}
            onChange={patchSalonClientBooking}
            onConfirm={confirmSalonClientBooking}
            onEditProfile={openProfileEdit}
          />
        )}


        <section className={`profilePanel mobilePage page-profile ${profileType === "salon" ? "is-salon-profile" : ""} ${!createdProfile || activeTab === "profile" ? "is-active" : ""} ${createdProfile && createdProfile.type === profileType ? "has-floating-cta" : ""}`} id="profile">
          {!createdProfile ? (
            <AuthGateForms
              authMode={authMode}
              signupStep={signupStep}
              authNotice={authNotice}
              authBusy={authBusy}
              profileType={profileType}
              activeRoleMeta={activeRoleMeta}
              onSelectRole={(roleId) => {
                setProfileType(roleId);
                setSignupStep("form");
                setAuthNotice("");
              }}
              onSwitchToLogin={() => { setAuthMode("login"); setAuthNotice(""); }}
              onSwitchToSignup={() => { setAuthMode("signup"); setSignupStep("role"); setAuthNotice(""); }}
              onBackToRole={() => setSignupStep("role")}
              onLoginSubmit={handleLoginSubmit}
              onProfileSubmit={handleProfileSubmit}
            />
          ) : (
            <>
            <ProfileHero
              profile={createdProfile}
              heroClass={activeCreatedMeta?.heroClass || ""}
              kicker={activeCreatedMeta?.kicker || ""}
              desc={activeCreatedMeta?.desc || ""}
              salonStats={salonSocialStats}
              artistStats={{
                followers: artistSocialStats.followers,
                portfolioCount: visibleArtistPortfolio.length,
                bookingCount: artistBookingList.length
              }}
              activePanel={createdProfile?.type === "salon" ? salonHeroSheet : profileView}
              onOpenSaved={() => {
                refreshSaves();
                if (createdProfile?.type === "salon") {
                  setSalonHeroSheet((prev) => (prev === "saved" ? null : "saved"));
                } else {
                  setProfileView((prev) => (prev === "saved" ? "overview" : "saved"));
                }
              }}
              onOpenNotifications={() => {
                if (createdProfile?.type === "salon") {
                  setSalonHeroSheet((prev) => (prev === "notifications" ? null : "notifications"));
                } else if (createdProfile?.type === "artist" || createdProfile?.type === "client") {
                  if (createdProfile?.type === "client") markClientBookingsSeen();
                  setProfileView((prev) => (prev === "notifications" ? "overview" : "notifications"));
                }
              }}
              notificationCount={
                createdProfile?.type === "salon"
                  ? salonUnreadNoticeCount + recentlyExpiredSalonBookings.length
                  : createdProfile?.type === "artist"
                    ? pendingArtistBookingRequests.length + pendingArtistSalonInvites.length + recentlyExpiredArtistBookings.length
                    : createdProfile?.type === "client"
                      ? (profileSettings.reservationAlerts === false ? 0 : unseenClientBookingCount)
                      : 0
              }
              onShare={shareSalonOwnerProfile}
              showShare={createdProfile?.type === "salon"}
              onPreviewPublic={() => {
                if (createdProfile?.type === "artist" && createdProfile.id) {
                  openPublicArtistProfile({
                    id: createdProfile.id,
                    name: createdProfile.data?.name || "",
                    avatar: createdProfile.data?.avatar || "",
                    area: createdProfile.data?.area || ""
                  });
                }
              }}
              modeRail={createdProfile?.type === "salon" ? profileModeRail : null}
            />

            {createdProfile?.type !== "salon" && profileModeRail}

          {createdProfile.type === profileType ? (
            <div className={`createdProfile ${activeRoleMeta.heroClass || ""}`}>
              {profileView === "overview" && (
                <>
                  {profileType === "salon" ? (
                    salonWorkspace ? (
                      <div className={`salonWorkspacePanel is-${salonWorkspace}`} aria-label="ورک‌اسپیس سالن">
                      {salonWorkspace === "staff" && (
                        <SalonStaffWorkspace
                          activeStaffCount={activeStaffCount}
                          pendingInvites={pendingSalonArtistInvites}
                          staffList={safeSalonStaffList}
                          onInviteNearby={openNearbyArtistInvite}
                          onCancelInvite={cancelSalonArtistInvite}
                          onOpenStaffPublic={openSalonStaffPublicProfile}
                          onManageStaff={setSelectedArtistProfile}
                        />
                      )}

                      {salonWorkspace === "hours" && (
                        <SalonServicesWorkspace
                          services={salonServiceList}
                          staffList={safeSalonStaffList}
                          serviceArtistMenuId={serviceArtistMenuId}
                          onMenuToggle={setServiceArtistMenuId}
                          onCreate={openSalonServiceCreate}
                          onToggleArtist={toggleSalonServiceArtist}
                          onClearArtists={(service) => assignSalonServiceArtist(service, null)}
                          onEdit={editArtistService}
                          onDelete={deleteSalonService}
                        />
                      )}

                      {salonWorkspace === "portfolio" && (
                        <ProfileGallery
                          label="گالری پست‌ها"
                          items={salonPortfolioList}
                          onAdd={() => openPortfolioComposer()}
                          addLabel="ایجاد پست"
                          getFallbackStyle={getPortfolioCardStyle}
                          editingId={salonWorkDraft && salonWorkDraft.id !== "new" ? salonWorkDraft.id : null}
                          onItemClick={(item) => setSalonPreviewWorkId(item.id)}
                          composeValue={salonWorkDraft}
                          onComposeChange={setSalonWorkDraft}
                          onComposeClose={resetPortfolioComposer}
                          onComposeSubmit={addSalonPortfolio}
                          onComposeDelete={deleteSalonPortfolioFromComposer}
                          onComposeNotify={setAppToast}
                          onComposeImageClear={clearSalonWorkImage}
                          composeTagOptions={salonWorkTagOptions}
                          composeTagMenuOpen={salonWorkTagMenuOpen}
                          onComposeTagMenuOpenChange={setSalonWorkTagMenuOpen}
                          composeSaving={portfolioSaving}
                          loading={salonWorkspaceLoading}
                          composeAriaLabel={salonWorkDraft?.id === "new" ? "پست جدید" : "ویرایش پست"}
                          composeSubmitLabel={salonWorkDraft?.id === "new" ? "انتشار پست" : "ذخیره تغییرات"}
                        />
                      )}
                      </div>
                    ) : (
                    <SalonScheduleDashboard
                      pendingCollabRequests={pendingSalonCollabRequests}
                      onApproveCollab={(id) => updateSalonCollabRequest(id, "تایید شد")}
                      onDeclineCollab={(id) => updateSalonCollabRequest(id, "رد شد")}
                      reservationRequests={reservationRequestList}
                      bookingDateForSlots={bookingDateForSlots}
                      onApproveRequest={approveReservationRequest}
                      onDeclineRequest={declineReservationRequest}
                      requestBusyId={salonRequestBusyId}
                      weekTabs={salonScheduleWeekTabs}
                      selectedDay={activeScheduleDay}
                      onSelectDay={setScheduleViewDay}
                      historyBookings={salonHistoryAppointments}
                      dayAppointments={scheduleDayAppointments}
                      emptyDayLabel={activeScheduleDayLabel}
                      staffList={safeSalonStaffList}
                      loading={salonWorkspaceLoading}
                      onOpenClient={(booking) => openScheduleBookingMenu(booking)}
                      onOpenBookingMenu={openScheduleBookingMenu}
                      historyOpen={salonWeekHistoryOpen}
                      onHistoryOpenChange={setSalonWeekHistoryOpen}
                    />
                    )
                  ) : profileType === "artist" ? (
                    <ArtistOverviewReviews
                      galleryItems={artistGalleryItems}
                      loading={artistWorkspaceLoading}
                      galleryTags={artistGalleryTags}
                      galleryFilter={artistGalleryFilter}
                      onGalleryFilterChange={setArtistGalleryFilter}
                      onAddWork={() => openArtistWorkModal({
                        id: "new",
                        title: "",
                        tag: artistServiceList[0]?.name || "",
                        caption: "",
                        image: "",
                        saves: "۰",
                        views: "۰",
                        isPublic: true,
                        featured: false
                      })}
                      onItemClick={openArtistWorkPreview}
                      composeValue={editingArtistWork}
                      onComposeChange={setEditingArtistWork}
                      onComposeClose={closeArtistWorkModal}
                      onComposeSubmit={saveArtistWork}
                      composeSaving={artistWorkSaving}
                      onComposeDelete={deleteArtistWork}
                      onComposeNotify={setAppToast}
                      onComposeImageClear={clearArtistWorkImage}
                      composeTagOptions={artistWorkTagOptions}
                      composeTagMenuOpen={artistWorkTagMenuOpen}
                      onComposeTagMenuOpenChange={setArtistWorkTagMenuOpen}
                    />
                  ) : profileType === "client" ? (
                    <ClientProfileOverview
                      profile={createdProfile}
                      bookings={clientBookingList}
                      savedCount={savedPosts.length}
                      onEditProfile={openProfileEdit}
                      onOpenSaved={() => {
                        refreshSaves();
                        setProfileView("saved");
                      }}
                      onOpenBookings={() => setProfileView("bookings")}
                    />
                  ) : null}
                </>
              )}

              {profileView === "bookings" && profileType === "client" && (
                <div className="clientActivityStack" aria-label="فعالیت من">
                  <ClientBookingsPanel
                    bookings={clientBookingList}
                    onOpenSettings={setClientBookingSettings}
                    onRebook={rebookFromBooking}
                  />
                </div>
              )}

              {profileView === "bookings" && profileType === "artist" && (
                <ArtistScheduleBoard
                  breakTime={artistBreakTime}
                  onOpenBreakEditor={openArtistBreakEditor}
                  weekTabs={artistBookingsWeekTabs}
                  selectedDay={activeArtistScheduleDateKey}
                  onSelectDay={setArtistBookingSelectedDay}
                  bookings={artistBookingList}
                  dayRows={artistScheduleDayRows}
                  dayLabel={activeArtistScheduleDayLabel}
                  loading={artistWorkspaceLoading}
                  onOpenClient={(booking) => openScheduleBookingMenu(booking, "artist")}
                  onOpenBookingMenu={(booking) => openScheduleBookingMenu(booking, "artist")}
                />
              )}

              {profileView === "services" && profileType === "artist" && (
                <ArtistServicesPanel
                  services={artistServiceList}
                  onCreate={openArtistServiceCreate}
                  onEdit={editArtistService}
                  onDelete={deleteArtistService}
                />
              )}

              {profileView === "collabs" && profileType === "artist" && (
                <ArtistCollabBoard
                  salons={salonDirectory}
                  offers={artistCollabOffers}
                  invites={artistSalonInviteList}
                  inviteRespondBusyId={artistInviteRespondBusyId}
                  teams={artistTeams}
                  teamBusyId={artistTeamBusyId}
                  onLeaveTeam={leaveArtistSalonTeam}
                  draft={artistCollabDraft}
                  onDraftChange={(patch) => setArtistCollabDraft((draft) => ({ ...draft, ...patch }))}
                  onSubmit={addArtistCollabOffer}
                  onDelete={deleteArtistCollabOffer}
                  onInviteRespond={respondArtistSalonInvite}
                />
              )}

            </div>
          ) : null}
            </>
          )}

        </section>

        <ScheduleBookingMenuModal
          open={Boolean(
            scheduleBookingMenu
            && (createdProfile?.type === "salon" || createdProfile?.type === "artist")
          )}
          booking={scheduleBookingMenu}
          view={scheduleBookingView}
          onViewChange={setScheduleBookingView}
          timeSlots={bookingDaySlots}
          staffOptions={safeSalonStaffList.length ? safeSalonStaffList : bookingStaffOptions}
          onClose={closeScheduleBookingMenu}
          onChangeTime={changeScheduleBookingTime}
          onChangeStaff={changeScheduleBookingStaff}
          onCancel={cancelScheduleBooking}
          onApprove={async () => {
            if (!scheduleBookingMenu) return;
            if (scheduleBookingMenu.ownerType === "salon") {
              await approveReservationRequest(scheduleBookingMenu.id);
            } else {
              await confirmArtistBookingRequest(scheduleBookingMenu.id);
            }
            closeScheduleBookingMenu();
          }}
          onDecline={async () => {
            if (!scheduleBookingMenu) return;
            if (scheduleBookingMenu.ownerType === "salon") {
              await declineReservationRequest(scheduleBookingMenu.id);
            } else {
              await declineArtistBookingRequest(scheduleBookingMenu.id);
            }
            closeScheduleBookingMenu();
          }}
          busy={scheduleBookingBusy}
        />

        {createdProfile?.type === "salon" && salonHeroSheet === "notifications" && (
          <ProfileSheet
            title="اعلان‌ها"
            label="اعلان‌ها"
            kicker="داشبورد سالن"
            panelClassName="salonNotificationsSheetPanel"
            open
            onClose={() => setSalonHeroSheet(null)}
          >
            <div className="salonNotificationsPanel">
              <article>
                <span><BellRing size={18} /></span>
                <div>
                  <b>اطلاع‌رسانی رزروها</b>
                  <small>{reservationRequestList.length ? `${toPersianDigits(reservationRequestList.length)} درخواست رزرو در انتظار بررسی است.` : "درخواست رزرو تازه‌ای ثبت نشده است."}</small>
                </div>
                <em>{toPersianDigits(reservationRequestList.length)}</em>
              </article>
              <article>
                <span><PageIcon name="collab" size={22} /></span>
                <div>
                  <b>همکاری و پرسنل</b>
                  <small>{pendingSalonCollabRequests.length ? `${toPersianDigits(pendingSalonCollabRequests.length)} درخواست همکاری نیاز به پاسخ دارد.` : "درخواست همکاری تازه‌ای نداری."}</small>
                </div>
                <em>{toPersianDigits(pendingSalonCollabRequests.length)}</em>
              </article>
              <article>
                <span><PageIcon name="bookings" size={22} /></span>
                <div>
                  <b>برنامه امروز</b>
                  <small>{salonAppointmentList.length ? `${toPersianDigits(salonAppointmentList.length)} نوبت در برنامه سالن ثبت شده است.` : "برنامه امروز خالی است."}</small>
                </div>
                <em>{toPersianDigits(salonAppointmentList.length)}</em>
              </article>
            </div>

            {reservationRequestList.length > 0 && (
              <section className="salonRequestsBoard" aria-label="درخواست‌های رزرو در انتظار پاسخ">
                <div className="boardHead">
                  <div>
                    <span>درخواست‌های رزرو</span>
                    <strong>نیاز به تایید شما</strong>
                  </div>
                  <b>{toPersianDigits(reservationRequestList.length)} درخواست</b>
                </div>
                <div className="reservationRequestList">
                  {reservationRequestList.map((request) => {
                    const busy = String(salonRequestBusyId) === `reservation:${request.id}`;
                    const anyBusy = Boolean(salonRequestBusyId);
                    return (
                      <article className="reservationRequestCard" key={request.id}>
                        <div className="requestCardMain">
                          <div className="requestCardWho">
                            <strong>{request.client}</strong>
                            <span className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{request.service}</span>
                            <small>
                              <b>{request.staff}</b>
                              <em>مسئول</em>
                            </small>
                          </div>
                          <div className="requestCardAside">
                            <SegmentClock value={request.time} size="xs" as="span" />
                            <div className="requestCardWhen">
                              <em>{request.day}</em>
                              <span>{request.date}</span>
                            </div>
                          </div>
                        </div>
                        <div className="requestActions">
                          <button
                            type="button"
                            className="is-approve"
                            disabled={anyBusy}
                            onClick={() => approveReservationRequest(request.id)}
                          >
                            <Check size={15} />
                            {busy ? "…" : "تایید"}
                          </button>
                          <button
                            type="button"
                            className="is-decline"
                            disabled={anyBusy}
                            onClick={() => declineReservationRequest(request.id)}
                          >
                            <X size={15} />
                            {busy ? "…" : "رد"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {recentlyExpiredSalonBookings.length > 0 && (
              <section className="salonRequestsBoard salonExpiredNoticeBoard" aria-label="درخواست‌های منقضی‌شده اخیر">
                <div className="boardHead">
                  <div>
                    <span>منقضی‌شده‌های اخیر</span>
                    <strong>بدون پاسخ در بازه ۱ ساعته باقی ماندند</strong>
                  </div>
                  <b>{toPersianDigits(recentlyExpiredSalonBookings.length)} مورد</b>
                </div>
                <div className="reservationRequestList">
                  {recentlyExpiredSalonBookings.map((booking) => (
                    <article className="reservationRequestCard is-expiredNotice" key={booking.id}>
                      <div className="requestCardMain">
                        <div className="requestCardWho">
                          <strong>{booking.client}</strong>
                          <span className="svcInline"><ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />{booking.service}</span>
                        </div>
                        <div className="requestCardAside">
                          <span className="expiredNoticeTag">
                            <TimerOff size={14} />
                            منقضی شد
                          </span>
                          <div className="requestCardWhen">
                            <em>{formatRelativeBookingDayLabel(booking.booking_date)}</em>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </ProfileSheet>
        )}

        {createdProfile?.type === "artist" && profileView === "notifications" && (
          <ProfileSheet
            title="اعلان‌ها"
            label="اعلان‌ها"
            kicker="داشبورد آرتیست"
            panelClassName="salonNotificationsSheetPanel"
            open
            onClose={() => setProfileView("overview")}
          >
            <div className="salonNotificationsPanel">
              <article>
                <span><BellRing size={18} /></span>
                <div>
                  <b>نوبت‌های تازه</b>
                  <small>{pendingArtistBookingRequests.length ? `${toPersianDigits(pendingArtistBookingRequests.length)} نوبت تازه هنوز بررسی نشده است.` : "نوبت تازه‌ای ثبت نشده است."}</small>
                </div>
                <em>{toPersianDigits(pendingArtistBookingRequests.length)}</em>
              </article>
              <article>
                <span><PageIcon name="collab" size={22} /></span>
                <div>
                  <b>دعوت همکاری سالن‌ها</b>
                  <small>{pendingArtistSalonInvites.length ? `${toPersianDigits(pendingArtistSalonInvites.length)} دعوت همکاری نیاز به پاسخ دارد.` : "دعوت همکاری تازه‌ای نداری."}</small>
                </div>
                <em>{toPersianDigits(pendingArtistSalonInvites.length)}</em>
              </article>
              <article>
                <span><CalendarClock size={18} /></span>
                <div>
                  <b>برنامه نوبت‌ها</b>
                  <small>{artistBookingList.length ? `${toPersianDigits(artistBookingList.length)} نوبت در برنامه‌ات ثبت شده است.` : "برنامه نوبت‌ها خالی است."}</small>
                </div>
                <em>{toPersianDigits(artistBookingList.length)}</em>
              </article>
            </div>

            {pendingArtistBookingRequests.length > 0 && (
              <section className="salonRequestsBoard" aria-label="نوبت‌های تازه در انتظار پاسخ">
                <div className="boardHead">
                  <div>
                    <span>نوبت‌های تازه</span>
                    <strong>نیاز به تایید شما</strong>
                  </div>
                  <b>{toPersianDigits(pendingArtistBookingRequests.length)} نوبت</b>
                </div>
                <div className="reservationRequestList">
                  {pendingArtistBookingRequests.map((request) => {
                    const busy = String(artistRequestBusyId) === `booking:${request.id}`;
                    const anyBusy = Boolean(artistRequestBusyId);
                    return (
                      <article className="reservationRequestCard" key={request.id}>
                        <div className="requestCardMain">
                          <div className="requestCardWho">
                            <strong>{request.client || "مشتری"}</strong>
                            <span className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{request.service}</span>
                            {request.phone ? <small dir="ltr">{request.phone}</small> : null}
                          </div>
                          <div className="requestCardAside">
                            <SegmentClock value={request.time} size="xs" as="span" />
                            <div className="requestCardWhen">
                              <em>{formatRelativeBookingDayLabel(request.dateKey || request.date)}</em>
                            </div>
                          </div>
                        </div>
                        <div className="requestActions">
                          <button
                            type="button"
                            className="is-approve"
                            disabled={anyBusy}
                            onClick={() => confirmArtistBookingRequest(request.id)}
                          >
                            <Check size={15} />
                            {busy ? "…" : "تایید"}
                          </button>
                          <button
                            type="button"
                            className="is-decline"
                            disabled={anyBusy}
                            onClick={() => declineArtistBookingRequest(request.id)}
                          >
                            <X size={15} />
                            {busy ? "…" : "رد"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {recentlyExpiredArtistBookings.length > 0 && (
              <section className="salonRequestsBoard salonExpiredNoticeBoard" aria-label="نوبت‌های منقضی‌شده اخیر">
                <div className="boardHead">
                  <div>
                    <span>منقضی‌شده‌های اخیر</span>
                    <strong>بدون پاسخ در بازه ۱ ساعته باقی ماندند</strong>
                  </div>
                  <b>{toPersianDigits(recentlyExpiredArtistBookings.length)} مورد</b>
                </div>
                <div className="reservationRequestList">
                  {recentlyExpiredArtistBookings.map((request) => (
                    <article className="reservationRequestCard is-expiredNotice" key={request.id}>
                      <div className="requestCardMain">
                        <div className="requestCardWho">
                          <strong>{request.client || "مشتری"}</strong>
                          <span className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{request.service}</span>
                        </div>
                        <div className="requestCardAside">
                          <span className="expiredNoticeTag">
                            <TimerOff size={14} />
                            منقضی شد
                          </span>
                          <div className="requestCardWhen">
                            <em>{formatRelativeBookingDayLabel(request.dateKey || request.date)}</em>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </ProfileSheet>
        )}

        {createdProfile?.type === "client" && profileView === "notifications" && (
          <ProfileSheet
            title="اعلان‌ها"
            label="اعلان‌ها"
            kicker="فعالیت من"
            panelClassName="salonNotificationsSheetPanel"
            open
            onClose={() => setProfileView("overview")}
          >
            {(() => {
              const notifiableStatuses = ["تایید شده", "لغو", "منقضی شده"];
              const recentBookingNotices = clientBookingList
                .filter((booking) => notifiableStatuses.includes(booking.status || ""))
                .sort((a, b) => new Date(toIsoLikeTimestamp(b.created_at)) - new Date(toIsoLikeTimestamp(a.created_at)))
                .slice(0, 20);
              return recentBookingNotices.length ? (
                <div className="reservationRequestList" aria-label="آخرین تغییرات رزروها">
                  {recentBookingNotices.map((booking) => {
                    const StatusIcon = booking.status === "تایید شده" ? Check : booking.status === "لغو" ? X : TimerOff;
                    const statusClass = booking.status === "تایید شده" ? "is-approve" : booking.status === "لغو" ? "is-decline" : "is-expiredNotice";
                    return (
                      <article className={`reservationRequestCard ${statusClass}`} key={`${booking.bookingSource || "salon"}-${booking.id}`}>
                        <div className="requestCardMain">
                          <div className="requestCardWho">
                            <strong>{booking.salonName || booking.salon_name || "سالن"}</strong>
                            <span className="svcInline"><ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />{booking.service}</span>
                          </div>
                          <div className="requestCardAside">
                            <span className="expiredNoticeTag">
                              <StatusIcon size={14} />
                              {booking.status}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="salonNotificationsPanel">
                  <article>
                    <span><BellRing size={18} /></span>
                    <div>
                      <b>هنوز اعلانی نداری</b>
                      <small>تغییر وضعیت رزروهایت اینجا نمایش داده می‌شود.</small>
                    </div>
                  </article>
                </div>
              );
            })()}
          </ProfileSheet>
        )}

        {createdProfile && (
          (createdProfile.type === "salon" && salonHeroSheet === "saved")
          || (createdProfile.type !== "salon" && profileView === "saved")
        ) && (
          <ProfileSheet
            title="ذخیره‌شده‌ها"
            label="ذخیره‌شده‌ها"
            kicker={activeCreatedMeta?.kicker || "پروفایل"}
            open
            onClose={() => {
              if (createdProfile.type === "salon") setSalonHeroSheet(null);
              else setProfileView("overview");
            }}
          >
            {renderSavedPosts()}
          </ProfileSheet>
        )}

        <ClientBookingSettingsModal
          key={clientBookingSettings ? `${clientBookingSettings.bookingSource || "salon"}-${clientBookingSettings.id}` : "none"}
          booking={clientBookingSettings}
          onClose={() => setClientBookingSettings(null)}
          onCancelBooking={cancelClientBooking}
          onRebookSalon={(booking) => {
            setClientBookingSettings(null);
            rebookFromBooking(booking);
          }}
        />

        <MobileFloatingCta
          open={
            activeTab === "profile"
            && Boolean(createdProfile)
            && createdProfile.type === profileType
            && createdProfile.type !== "client"
          }
          profileType={createdProfile?.type}
          modeRail={
            createdProfile?.type === "salon" && !salonWorkspace && profileView === "overview"
              ? salonWeekStripFloating
              : null
          }
        />

        {createdProfile?.type === "salon" && (
          <SalonToolSheets
            open={salonToolSheetOpen}
            tool={salonTool}
            inventory={salonInventory}
            tasks={salonTasks}
            onClose={closeSalonToolSheet}
            onNotice={setAppToast}
          />
        )}
        <SalonStaffProfileModal
          staff={selectedArtistProfile}
          stats={selectedStaffStats}
          roleOptions={salonArtistRoleOptions}
          onClose={() => setSelectedArtistProfile(null)}
          onUpdate={(person, patch, notice) => {
            updateSalonStaff(person.name, patch, notice);
            setSelectedArtistProfile({ ...person, ...patch });
          }}
          onRemove={(person) => {
            removeSalonStaff(person.name);
            setSelectedArtistProfile(null);
          }}
          onOpenPublic={openSalonStaffPublicProfile}
        />
        <ClientProfileModal
          client={scheduleBookingMenu ? null : selectedBookingClient}
          onClose={() => setSelectedBookingClient(null)}
        />
        <BookingSheet
          open={bookingSheetOpen && (createdProfile?.type === "salon" || createdProfile?.type === "artist")}
          role={createdProfile?.type === "artist" ? "artist" : "salon"}
          title="ایجاد رزرو"
          onClose={closeBookingSheet}
        >
          <BookingCreateForm
            role={createdProfile?.type === "artist" ? "artist" : "salon"}
            customerOptions={bookingCustomerOptions}
            onAddService={() => {
              closeBookingSheet();
              if (createdProfile?.type === "artist") openArtistServiceCreate();
              else openSalonServiceCreate();
            }}
            onSubmit={(event) => {
              if (createdProfile?.type === "artist") {
                handleArtistBookingCreate(event);
                return;
              }
              addSalonAppointment(event, { bookingDateForSlots, selectedBookingStaff });
            }}
            serviceOptions={(createdProfile?.type === "artist" ? artistServiceList : bookingServiceOptions).map((item) => ({
              value: item.name,
              label: item.name,
              emoji: item.emoji,
              withIcon: true,
              meta: [item.price ? `${toPersianDigits(item.price)} تومان` : "", item.duration].filter(Boolean).join(" · ")
            }))}
            serviceValue={
              createdProfile?.type === "artist"
                ? (bookingServiceName || artistServiceList[0]?.name || "")
                : (selectedBookingService?.name || "")
            }
            serviceMenuOpen={bookingSelectMenu === "service"}
            onServiceMenuOpenChange={(next) => setBookingSelectMenu(next ? "service" : "")}
            onServiceChange={setBookingServiceName}
            staffOptions={bookingStaffOptions.map((person) => ({
              value: person.name,
              label: person.name,
              meta: person.role || ""
            }))}
            staffValue={selectedBookingStaff}
            staffMenuOpen={bookingSelectMenu === "staff"}
            onStaffMenuOpenChange={(next) => setBookingSelectMenu(next ? "staff" : "")}
            onStaffChange={setBookingStaffName}
            dayOptions={
              createdProfile?.type === "artist"
                ? artistBookingDayOptions
                : salonScheduleWeekTabs
                  // A booking can only ever be created for today or later --
                  // this same tab list is shared with the schedule-browsing
                  // view (which legitimately looks a few days into the
                  // past), so the past-date exclusion belongs here, not on
                  // salonScheduleWeekTabs itself.
                  .filter((tab) => (tab.offset ?? 0) >= 0)
                  .filter((tab) => {
                    const hour = salonHoursList.find((item) => item.day === tab.day);
                    return hour ? Boolean(hour.active) : true;
                  })
                  .map((tab) => ({
                    value: tab.dateKey,
                    label: `${tab.label} ${tab.sub || ""}`.trim()
                  }))
            }
            dayValue={createdProfile?.type === "artist" ? artistBookingDateForSlots : bookingDateForSlots}
            onDayChange={setBookingDate}
            timeOptions={createdProfile?.type === "artist" ? artistBookingFreeSlots : bookingFreeSlots}
            timeValue={bookingTime}
            onTimeChange={setBookingTime}
            submitting={
              createdProfile?.type === "artist"
                ? artistBookingSubmitting
                : salonBookingSubmitting
            }
            submitDisabled={
              createdProfile?.type === "artist"
                ? !artistServiceList.length
                : !salonServiceList.length
            }
          />
        </BookingSheet>
        <SalonNearbyInviteSheet
          open={artistInviteOpen}
          loading={nearbyArtistsLoading}
          artists={nearbyArtists}
          busyId={artistInviteBusyId}
          salonId={createdProfile?.id}
          salonName={createdProfile?.data?.name || "سالن"}
          onClose={() => {
            setArtistInviteOpen(false);
            setArtistInviteBusyId("");
          }}
          onInvite={inviteNearbyArtist}
        />

        <ProfileEditModal
          open={profileEditOpen && Boolean(createdProfile)}
          profile={createdProfile}
          avatarDraft={profileEditAvatar}
          onClose={() => { setProfileEditOpen(false); setProfileEditAvatar(""); }}
          onAvatarUpload={handleProfileAvatarUpload}
          onClearAvatar={() => setProfileEditAvatar("")}
          onSubmit={updateRegisteredProfile}
          saving={profileSaving}
        />
        <ArtistWorkPreviewModal
          work={salonPreviewWork}
          works={salonPortfolioList}
          owner={createdProfile?.type === "salon" ? {
            name: createdProfile.data?.name || "",
            role: "سالن زیبایی",
            area: createdProfile.data?.area || "",
            avatar: createdProfile.data?.avatar || ""
          } : null}
          onClose={() => setSalonPreviewWorkId(null)}
          onEdit={(item) => {
            setSalonPreviewWorkId(null);
            openPortfolioComposer(item);
          }}
          onNavigate={(next) => setSalonPreviewWorkId(next.id)}
          onShare={sharePost}
        />
        <ArtistWorkPreviewModal
          work={previewingArtistWork}
          works={artistGalleryItems}
          owner={createdProfile?.type === "artist" ? {
            name: createdProfile.data?.name || "",
            role: createdProfile.data?.service || "",
            area: createdProfile.data?.area || "",
            avatar: createdProfile.data?.avatar || ""
          } : null}
          onClose={closeArtistWorkPreview}
          onEdit={openArtistWorkModal}
          onNavigate={(next) => setPreviewingArtistWorkId(next.id)}
          onShare={sharePost}
        />
        <ArtistBreakEditorModal
          open={artistBreakEditorOpen}
          draft={artistBreakDraft}
          hasBreak={Boolean(artistBreakTime)}
          saving={artistBreakSaving}
          onDraftChange={setArtistBreakDraft}
          onSave={saveArtistBreakTime}
          onClear={clearArtistBreakTime}
          onClose={closeArtistBreakEditor}
        />
        <ServiceComposerModal
          open={artistServiceCreateOpen}
          mode={artistServiceCreateMode}
          draft={artistServiceDraft}
          catalog={SERVICE_CATALOG}
          specialties={createdProfile?.data?.service || ""}
          existingServices={activeServiceManagerList}
          onClose={closeArtistServiceCreate}
          onModeChange={setArtistServiceCreateMode}
          onDraftChange={(patch) => setArtistServiceDraft((prev) => ({ ...prev, ...patch }))}
          onSubmitCustom={addArtistService}
          onPickPreset={addArtistServicePreset}
          onCustomizePreset={customizeServicePreset}
        />
        {appToast && typeof document !== "undefined" ? createPortal(
          // Portaled straight to <body> — this toast has an intentionally
          // enormous z-index (see .appToast) to float above every sheet/
          // modal in the app, but that only works against siblings in the
          // same stacking context. Any modal rendered inline (not portaled)
          // sits inside .mobilePage.is-active, whose page-in animation
          // leaves a `transform` on it, which pins a NEW stacking context —
          // trapping this toast behind portaled overlays (like
          // ScheduleBookingMenuModal, SalonHoursEditor) no matter how high
          // its own z-index is set.
          <div className="appToast" role="status" aria-live="polite">
            <ShieldCheck size={17} />
            <span>{appToast}</span>
          </div>,
          document.body
        ) : null}

        {pushSoftAskVisible && (
          <div className="pushSoftAsk" role="status" aria-live="polite">
            <BellRing size={17} />
            <div>
              <b>اعلان‌ها را فعال کن</b>
              <small>تا از تایید، رد یا انقضای رزروهایت حتی وقتی اپ باز نیست باخبر شوی.</small>
            </div>
            <div className="pushSoftAskActions">
              <button
                type="button"
                onClick={() => {
                  setPushSoftAskVisible(false);
                  void subscribeToPushNotifications();
                }}
              >
                فعال کن
              </button>
              <button
                type="button"
                onClick={() => {
                  setPushSoftAskVisible(false);
                  window.localStorage.setItem("zibaban_push_soft_ask_dismissed", "1");
                }}
              >
                بعداً
              </button>
            </div>
          </div>
        )}

        {createdProfile?.type === "client" ? (
          <ClientBookingTracker bookings={clientBookingList} onOpen={setClientBookingSettings} />
        ) : null}

        <BottomNav
          activeTab={activeTab}
          createdProfile={createdProfile}
          onTabChange={goToTab}
          showCreateBooking={(createdProfile?.type === "artist" || createdProfile?.type === "salon") && activeTab === "profile"}
          onCreateBooking={() => {
            if (bookingSheetOpen) {
              closeBookingSheet();
              return;
            }
            openBookingSheet();
          }}
        />
        <PublicArtistModal
          artist={selectedPublicArtist}
          heroImage={publicArtistHeroImage}
          view={publicArtistView}
          portfolio={publicArtistPortfolio}
          services={publicArtistServices}
          following={isFollowingPublicArtist}
          galleryTags={publicArtistGalleryTags}
          galleryFilter={publicArtistGalleryFilter}
          featuredWork={publicArtistFeatured}
          galleryRest={publicArtistGalleryRest}
          selectedServiceId={publicArtistSelectedServiceId}
          bookingDay={publicArtistBookingDay}
          bookingSlot={publicArtistBookingSlot}
          parseDuration={parseServiceDurationMinutes}
          getCardStyle={getPortfolioCardStyle}
          onClose={closePublicArtistProfile}
          onShare={shareArtistProfile}
          saved={isSavedPublicArtist}
          onSave={() => selectedPublicArtist && toggleSavePublicArtist(selectedPublicArtist)}
          onFollow={() => selectedPublicArtist && toggleFollowPublicArtist(selectedPublicArtist)}
          onViewChange={setPublicArtistView}
          onGalleryFilterChange={setPublicArtistGalleryFilter}
          onOpenWork={openPublicArtistWork}
          onSelectService={selectPublicArtistService}
          onBookingDayChange={setPublicArtistBookingDay}
          onBookingSlotChange={setPublicArtistBookingSlot}
          onConfirmBooking={confirmPublicArtistBooking}
          bookingBusy={publicArtistBookingBusy}
          clientPhone={createdProfile?.data?.phone || ""}
          onEditProfile={openProfileEdit}
        />
        <PostPreviewModal
          post={selectedPost}
          posts={selectedPostSiblings}
          onNavigate={openPost}
          postOwner={selectedPostOwner}
          isSaved={selectedPostIsSaved}
          beautyPassport={beautyPassport}
          passportMatch={selectedPost ? getPassportMatch(selectedPost) : ""}
          onClose={() => setSelectedPost(null)}
          onToggleSaved={() => selectedPost && toggleSavedPost(selectedPost.title, selectedPost)}
          onShare={() => selectedPost && sharePost(selectedPost)}
          onOpenArtistProfile={() => selectedPost && openPostOwnerProfile(selectedPost)}
        />
      </section>
    </main>
  );
}
