"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { PageIcon } from "../../components/PageIcon";
import { createPortal } from "react-dom";
import { BellRing, CalendarClock, Check, ShieldCheck, TimerOff, X } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { parseServiceDurationMinutes, toIsoLikeTimestamp } from "../../shared/lib/time";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import {
  profileRoleMeta,
  salonArtistRoleOptions
} from "../../shared/constants/roles";
import { ArtistBreakEditorModal, ArtistCollabBoard, ArtistOverviewReviews, ArtistServicesPanel, ArtistWorkPreviewModal, PublicArtistModal, useArtistWorkspace, usePublicArtistProfile } from "../artist";
import { AuthGateForms, createLogoutUiGapResets, useAuthSession } from "../auth";
import {
  PostPreviewModal,
  mapSharedPost,
  usePostActivity
} from "../posts";
import { SettingsPage } from "../settings";
import { ClientBookingTracker } from "../client/ClientBookingTracker";
import {
  ClientBookingSettingsModal,
  ClientBookingsPanel,
  ClientProfileOverview
} from "../client";
import { ProfileGallery } from "../profile/ProfileGallery";
import { ProfileHero } from "../profile/ProfileHero";
import { ProfileHeroWeekStrip } from "../profile/ProfileHeroWeekStrip";
import { ProfileModeRail } from "../profile/ProfileModeRail";
import { BookingCreateForm } from "../profile/BookingCreateForm";
import { BookingSheet } from "../profile/BookingSheet";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceComposerModal } from "../profile/ServiceComposerModal";
import { SalonClientBookingModal, SalonClientPage, SalonCustomersPage, SalonNearbyInviteSheet, SalonServicesWorkspace, SalonStaffProfileModal, SalonStaffWorkspace, SalonToolSheets, useSalonDirectory, useSalonWorkspace, getVisibleSalonServiceItems } from "../salons";
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
import { salonInventory, salonTasks } from "./mockData";
import { useShellNavigation } from "./useShellNavigation";
import { useScheduleViews } from "./useScheduleViews";
import { useSalonDerived } from "./useSalonDerived";

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
  const {
    salonWorkTagOptions,
    salonScheduleWeekTabs,
    activeStaffCount,
    salonSocialStats,
    activeServiceManagerList,
    activeSalonHours
  } = useSalonDerived({
    salonServiceList,
    safeSalonStaffList,
    selectedStaffName,
    salonAppointmentList,
    salonCollabRequestList,
    salonDirectory,
    createdProfile,
    salonPortfolioList,
    artistServiceList,
    salonHoursList
  });


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
  const {
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
  } = useScheduleViews({
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
  });

  const {
    getPassportMatch,
    getPortfolioCardStyle,
    refreshSaves,
    goToTab,
    rebookFromBooking,
    openPostOwnerProfile,
    openSalonStaffPublicProfile,
    shareSalonOwnerProfile,
    renderSavedPosts,
    setSalonPreviewWorkId,
    salonPreviewWork,
    selectedPostOwner,
    selectedPostSiblings,
    selectSalonWithDetail
  } = useShellNavigation({
    authCascadeRef,
    refreshSavedPosts,
    setSalonDirectory,
    refreshSalonSystemData,
    refreshArtistWorkspace,
    refreshClientBookings,
    resetPostActivity,
    resetSalonClient,
    resetPublicArtistProfile,
    resetArtistWorkspace,
    resetSalonWorkspace,
    setSavedArtists,
    createdProfile,
    appToast,
    activeTab,
    profileView,
    salonTool,
    salonWorkspace,
    selectedSalon,
    selectedPublicArtist,
    salonPortfolioList,
    selectedPost,
    beautyPassport,
    setFollowedArtists,
    setFollowedSalons,
    setSavedSalonKeys,
    setSavedProfiles,
    toggleSaveSalon,
    toggleSavePublicArtist,
    setScheduleNow,
    setAppToast,
    setActiveTab,
    salonDirectory,
    salonStaffList,
    salonServiceList,
    closePublicArtistProfile,
    setSalonClientTab,
    setSelectedSalon,
    openPublicArtistProfile,
    setSelectedPost,
    setSelectedArtistProfile,
    shareSalonProfile,
    savedPosts,
    savedProfiles,
    openPost,
    toggleSavedPost,
    publicArtistPortfolio
  });


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
              meta: [item.price ? `${formatTomanNumber(parseTomanAmount(item.price))} تومان` : "", item.duration].filter(Boolean).join(" • ")
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
