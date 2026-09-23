"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  timeLabelToMinutes
} from "../../shared/lib/time";
import {
  formatRelativeBookingDayLabel,
  isPersianDateKey
} from "../../shared/lib/persianCalendar";
import {
  profileRoleMeta,
  salonArtistRoleOptions,
  salonArtistStatusOptions
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
  artistBookingDays,
  artistAvailableSlots,
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
  ExplorePage,
  ExplorePreviewModal,
  ExploreRatingModal,
  useExploreFeed
} from "../explore";
import {
  ClientBookingSettingsModal,
  ClientBookingsPanel,
  ClientProfileOverview
} from "../client";
import { getSaves } from "../../shared/api/saves";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";
import { ProfileGallery } from "../profile/ProfileGallery";
import { ProfileHero } from "../profile/ProfileHero";
import { ProfileModeRail } from "../profile/ProfileModeRail";
import { BookingCreateForm } from "../profile/BookingCreateForm";
import { BookingSheet } from "../profile/BookingSheet";
import {
  normalizeArtistScheduleBooking,
  normalizeSalonScheduleBooking,
  withScheduleTimeline
} from "../profile/ScheduleRow";
import { ProfileSavedPosts } from "../profile/ProfileSavedPosts";
import { ProfileSettingsSheet } from "../profile/ProfileSettingsSheet";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceComposerModal } from "../profile/ServiceComposerModal";
import {
  SalonClientBookingModal,
  SalonClientPage,
  SalonCreateStaffModal,
  SalonNearbyInviteSheet,
  SalonServicesWorkspace,
  SalonStaffProfileModal,
  SalonStaffWorkspace,
  SalonToolSheets,
  salonServiceCatalog,
  useSalonDirectory,
  useSalonWorkspace,
  getVisibleSalonServiceItems
} from "../salons";
import {
  ArtistScheduleBoard,
  SalonScheduleDashboard,
  ScheduleBookingMenuModal
} from "../schedule";
import { AuthBootScreen } from "./AuthBootScreen";

import { BottomNav } from "./BottomNav";
import { ClientProfileModal } from "./ClientProfileModal";
import { MobileFloatingCta } from "./MobileFloatingCta";
import { useBookingCreateSheet } from "./useBookingCreateSheet";
import { useProfileEditor } from "./useProfileEditor";
import { useScheduleBookingMenu } from "./useScheduleBookingMenu";
import { useServiceComposer } from "./useServiceComposer";
import { ProfileEditModal } from "./ProfileEditModal";
import { SalonClientFloatingDock } from "./SalonClientFloatingDock";
import {
  artistReviews,
  exploreArtistCatalog,
  explorePosts,
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

// SQLite's CURRENT_TIMESTAMP is UTC with no offset marker ("2026-09-19 10:30:00"),
// which JS parses as LOCAL time unless told otherwise — append "Z" so recency
// checks (e.g. "expired within the last day") aren't off by the browser's
// timezone offset.
function isWithinLastHours(sqliteTimestamp, hours) {
  if (!sqliteTimestamp) return false;
  const ms = Date.parse(`${sqliteTimestamp}Z`.replace(" ", "T"));
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

export function HomeApp() {
  const [activeTab, setActiveTab] = useState("profile");
  const refreshExploreFeedRef = useRef(null);
  const refreshArtistWorkspaceRef = useRef(null);
  const notifyArtistBookingCreatedRef = useRef(null);
  const applySalonBookingsRef = useRef(null);
  const authCascadeRef = useRef({});
  const [appToast, setAppToast] = useState("");
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
      void c.refreshExploreFeed?.();
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
        await c.refreshExploreFeed?.();
        await c.refreshFollows?.();
        await c.refreshSaves?.();
        try {
          const [passportResponse, salonsResponse] = await Promise.all([
            fetch("/api/beauty-passport"),
            fetch("/api/salons")
          ]);
          const passportPayload = passportResponse.ok ? await passportResponse.json() : {};
          const salonsPayload = await salonsResponse.json();
          setBeautyPassport(passportPayload.passport || passportPayload.data?.passport || null);
          c.setSalonDirectory?.(salonsPayload.salons || salonsPayload.data?.salons || []);
        } catch {
          // ignore secondary loads
        }
      } else if (source === "register") {
        await c.refreshExploreFeed?.();
        await c.refreshFollows?.();
        await c.refreshSaves?.();
      } else if (source === "boot") {
        const [passportResponse] = await Promise.all([
          fetch("/api/beauty-passport")
        ]);
        if (isStale?.()) return;
        const passportPayload = passportResponse.ok ? await passportResponse.json() : {};
        setBeautyPassport(passportPayload.passport || passportPayload.data?.passport || null);
        await c.refreshFollows?.();
        await c.refreshSaves?.();
        if (isStale?.()) return;
      }

      if (profile?.type === "salon") await c.refreshSalonSystemData?.();
      if (profile?.type === "artist") await c.refreshArtistWorkspace?.();
      if (source === "boot" && profile?.type === "client") await c.refreshClientBookings?.();
      // Fire-and-forget: real push notifications (see app/lib/push.js) so a
      // salon/artist finds out about a new/expired request even when the
      // app isn't open, closing the gap the full-team audit flagged — an
      // installed-but-no-op service worker was the actual root cause of
      // "owner never finds out a request auto-expired". Every authenticated
      // session tries once; subscribeToPushNotifications no-ops quietly if
      // unsupported, already denied, or already subscribed.
      void subscribeToPushNotifications();
    },
    onLoggedOut: async () => {
      const c = authCascadeRef.current;
      c.resetExploreFeed?.();
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
      await c.refreshExploreFeed?.();
    }
  });

  const {
    explorePostList,
    exploreCategory,
    setExploreCategory,
    exploreRatingPicker,
    selectedPost,
    setSelectedPost,
    selectedPostComments,
    selectExplorePost,
    visibleExplorePosts,
    savedExplorePosts,
    selectedPostIsSaved,
    selectedPostUserRating,
    refreshExploreFeed,
    resetExploreFeed,
    toggleSavedPost,
    openExploreRatingPicker,
    closeExploreRatingPicker,
    setExploreRatingHover,
    confirmExploreRating,
    shareExplorePost,
    exploreLoading
  } = useExploreFeed({
    createdProfile,
    onNotice: setAppToast
  });

  refreshExploreFeedRef.current = refreshExploreFeed;

  const {
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
    salonClientBooking,
    salonClientBookingBusy,
    clientBookingList,
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
    confirmSalonClientBooking
  } = useSalonDirectory({
    createdProfile,
    onNotice: setAppToast,
    onShellNotice: setAppToast,
    onOwnerBookingsSync: (bookings) => applySalonBookingsRef.current?.(bookings, { bump: true }),
    onLinkedArtistBooked: (id) => notifyArtistBookingCreatedRef.current?.(id)
  });

  const {
    artistReviewList,
    artistSocialStats,
    artistSalonInviteList,
    artistInviteRespondBusyId,
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
    visibleArtistPortfolio,
    artistGalleryTags,
    artistGalleryItems,
    previewingArtistWork,
    artistReviewSummary,
    artistReplyingReviewId,
    artistReplyDraft,
    setArtistReplyDraft,
    artistReplySubmitting,
    openArtistReviewReply,
    closeArtistReviewReply,
    submitArtistReviewReply,
    artistWorkTagOptions,
    artistWorkVisibleTagOptions,
    nearestArtistBookings,
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
    handleArtistWorkImageUpload,
    clearArtistWorkImage,
    syncArtistWorkToExplore,
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
    onExploreRefresh: () => refreshExploreFeedRef.current?.(),
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
    artistCreateOpen,
    setArtistCreateOpen,
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
    artistCreateRole,
    setArtistCreateRole,
    artistCreateStatus,
    setArtistCreateStatus,
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
    addSalonStaff,
    openNearbyArtistInvite,
    inviteNearbyArtist,
    cancelSalonArtistInvite,
    updateSalonStaff,
    removeSalonStaff,
    updateSalonHour,
    updateSalonHoursPreset,
    addSalonService,
    assignSalonServiceArtist,
    toggleSalonServiceArtist,
    deleteSalonService,
    resetPortfolioComposer,
    openPortfolioComposer,
    handleSalonWorkImageUpload,
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
    onExploreRefresh: () => refreshExploreFeedRef.current?.(),
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
    },
    salonArtistRoleOptions,
    salonArtistStatusOptions
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
    saveProfileLocation,
    openProfileEdit,
    handleProfileAvatarUpload,
    toggleProfileSetting
  } = useProfileEditor({
    createdProfile,
    setCreatedProfile,
    setProfileType,
    setProfileView,
    setSalonHeroSheet,
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
    publicArtistReviews,
    publicArtistUserRating,
    publicArtistRatingHover,
    setPublicArtistRatingHover,
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
    confirmPublicArtistRating,
    toggleLikePublicArtistReview,
    confirmPublicArtistBooking,
    toggleFollowPublicArtist,
    toggleSavePublicArtist,
    shareArtistProfile,
    openPublicArtistWork,
    selectPublicArtistService,
    resetPublicArtistProfile
  } = usePublicArtistProfile({
    createdProfile,
    explorePostList,
    followedArtists,
    setFollowedArtists,
    setFollowedSalons,
    onNotice: setAppToast,
    onSelectExplorePost: setSelectedPost,
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

  const salonWorkTagOptions = useMemo(() => {
    const defaults = ["ناخن", "مو", "میکاپ", "عروس"];
    const fromList = Array.from(new Set(salonPortfolioList.map((item) => item.tag).filter(Boolean)));
    return Array.from(new Set([...defaults, ...fromList]));
  }, [salonPortfolioList]);

  const salonWorkVisibleTagOptions = useMemo(() => {
    const query = String(salonWorkDraft?.tag || "").trim();
    if (!query) return salonWorkTagOptions;
    const filtered = salonWorkTagOptions.filter((tag) => tag.includes(query));
    return filtered.length ? filtered : salonWorkTagOptions;
  }, [salonWorkTagOptions, salonWorkDraft?.tag]);

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
    const ratingValue = ownSalon?.rating || createdProfile?.data?.rating || "۰";
    return {
      rating: toPersianDigits(ratingValue || "۰"),
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
      : undefined;
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
    refreshExploreFeed,
    setSalonDirectory,
    refreshFollows,
    refreshSaves,
    refreshSalonSystemData,
    refreshArtistWorkspace,
    refreshClientBookings,
    resetExploreFeed,
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
    if (!serviceArtistMenuId) return undefined;
    const onPointerDown = (event) => {
      const openPick = document.querySelector(".is-pickingArtist .serviceArtistPick");
      if (openPick && openPick.contains(event.target)) return;
      setServiceArtistMenuId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [serviceArtistMenuId]);

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

  function resolveExploreArtist(post) {
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
        rating: post.rating || "",
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
        rating: fromDirectory?.rating || post.rating || "",
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
      rating: post.rating || "",
      bio: post.ownerBio || post.meta || "",
      source: null,
      kind: "artist",
      entityType: "artist"
    };
  }

  function buildOwnPublicSalon() {
    const ownStoryVideo = createdProfile?.data?.storyVideo || createdProfile?.data?.story_video || createdProfile?.data?.introVideo || createdProfile?.data?.intro_video || "";
    const ownStoryPoster = createdProfile?.data?.storyPoster || createdProfile?.data?.story_poster || createdProfile?.data?.introPoster || createdProfile?.data?.intro_poster || "";
    const ownStoryFields = {
      ...(ownStoryVideo ? {
        storyVideo: ownStoryVideo,
        story_video: ownStoryVideo,
        introVideo: ownStoryVideo,
        intro_video: ownStoryVideo
      } : {}),
      ...(ownStoryPoster ? {
        storyPoster: ownStoryPoster,
        story_poster: ownStoryPoster,
        introPoster: ownStoryPoster,
        intro_poster: ownStoryPoster
      } : {})
    };
    const fromDirectory = salonDirectory.find((salon) => (
      String(salon.id) === String(createdProfile?.id)
      || String(salon.source_key) === String(createdProfile?.id)
      || salon.name === createdProfile?.data?.name
    ));
    if (fromDirectory) {
      return {
        ...fromDirectory,
        ...ownStoryFields,
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
      rating: createdProfile.data?.rating || "",
      open: createdProfile.data?.open || "امروز",
      bio: createdProfile.data?.bio || "",
      avatar: createdProfile.data?.avatar || "",
      ...ownStoryFields,
      post_count: salonPortfolioList.length,
      follower_count: Number(createdProfile.data?.follower_count || 0),
      following_count: Number(createdProfile.data?.following_count || 0),
      portfolio: salonPortfolioList,
      staff: salonStaffList,
      services: salonServiceList
    };
  }

  function buildOwnStoryFields() {
    const data = createdProfile?.data || {};
    const video = data.storyVideo || data.story_video || data.introVideo || data.intro_video || "";
    const poster = data.storyPoster || data.story_poster || data.introPoster || data.intro_poster || "";
    if (!video && !poster) return null;
    return {
      ...(video ? {
        storyVideo: video,
        story_video: video,
        introVideo: video,
        intro_video: video
      } : {}),
      ...(poster ? {
        storyPoster: poster,
        story_poster: poster,
        introPoster: poster,
        intro_poster: poster
      } : {})
    };
  }

  const STORY_TYPE_LABELS = { salon: "سالن", artist: "آرتیست" };

  async function saveProfileStory(storyPayload) {
    const storyVideo = typeof storyPayload === "string" ? storyPayload : storyPayload?.video;
    const storyPoster = typeof storyPayload === "string" ? "" : storyPayload?.poster;
    if (!createdProfile || !STORY_TYPE_LABELS[createdProfile.type] || (!storyVideo && !storyPoster)) return;
    let persisted = false;
    let serverError = "";
    try {
      const response = await fetch("/api/profile/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: storyVideo, poster: storyPoster })
      });
      persisted = response.ok;
      if (!response.ok) {
        try {
          const errorBody = await response.json();
          serverError = errorBody?.error || "";
        } catch {
          serverError = "";
        }
      }
    } catch {
      persisted = false;
    }
    if (!persisted) {
      setAppToast(serverError || "ذخیره استوری در سرور انجام نشد؛ دوباره امتحان کن.");
      return;
    }
    const storyFields = {
      ...(storyVideo ? {
        storyVideo,
        story_video: storyVideo,
        introVideo: storyVideo,
        intro_video: storyVideo
      } : {}),
      ...(storyPoster ? {
        storyPoster,
        story_poster: storyPoster,
        introPoster: storyPoster,
        intro_poster: storyPoster
      } : {})
    };
    const nextProfile = {
      ...createdProfile,
      data: {
        ...createdProfile.data,
        ...storyFields
      }
    };
    const ownId = String(createdProfile.id || "");
    const ownName = createdProfile.data?.name || "";
    const matchesOwnSalon = (salon) => (
      String(salon.id || "") === ownId
      || String(salon.source_key || "") === ownId
      || (ownName && salon.name === ownName)
    );

    lockSession();
    writeAuthSession(nextProfile);
    setCreatedProfile(nextProfile);
    setSelectedSalon((current) => (current && matchesOwnSalon(current) ? { ...current, ...storyFields } : current));
    setSelectedPublicArtist((current) => (current && String(current.id || "") === ownId ? { ...current, ...storyFields } : current));
    setSalonDirectory((current) => current.map((salon) => (matchesOwnSalon(salon) ? { ...salon, ...storyFields } : salon)));
    setAppToast(storyVideo ? `استوری معرفی ${STORY_TYPE_LABELS[createdProfile.type]} ذخیره شد.` : `پوستر استوری ${STORY_TYPE_LABELS[createdProfile.type]} ذخیره شد.`);
  }

  async function deleteProfileStory() {
    if (!createdProfile || !STORY_TYPE_LABELS[createdProfile.type]) return;
    try {
      const response = await fetch("/api/profile/story", { method: "DELETE" });
      if (!response.ok) {
        setAppToast("حذف استوری انجام نشد؛ دوباره امتحان کن.");
        return;
      }
    } catch {
      setAppToast("حذف استوری انجام نشد؛ دوباره امتحان کن.");
      return;
    }
    const STORY_KEYS = ["storyVideo", "story_video", "introVideo", "intro_video", "storyPoster", "story_poster", "introPoster", "intro_poster"];
    const stripStoryFields = (entity) => {
      if (!entity) return entity;
      const next = { ...entity };
      for (const key of STORY_KEYS) delete next[key];
      return next;
    };
    const ownId = String(createdProfile.id || "");
    const ownName = createdProfile.data?.name || "";
    const matchesOwnSalon = (salon) => (
      String(salon.id || "") === ownId
      || String(salon.source_key || "") === ownId
      || (ownName && salon.name === ownName)
    );
    const nextProfile = { ...createdProfile, data: stripStoryFields(createdProfile.data) };
    lockSession();
    writeAuthSession(nextProfile);
    setCreatedProfile(nextProfile);
    setSelectedSalon((current) => (current && matchesOwnSalon(current) ? stripStoryFields(current) : current));
    setSelectedPublicArtist((current) => (current && String(current.id || "") === ownId ? stripStoryFields(current) : current));
    setSalonDirectory((current) => current.map((salon) => (matchesOwnSalon(salon) ? stripStoryFields(salon) : salon)));
    setAppToast(`استوری ${STORY_TYPE_LABELS[createdProfile.type]} حذف شد.`);
  }

  // Hoisted out of openExploreArtistProfile (below) so it can also be reused
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
        rating: salonLike.rating,
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

      let nextSalon = salonDirectory.find(matchesSalon) || fallbackSalon;
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

      // The list stays light (no story video); pull the full detail for the public page.
      if (nextSalon?.id) {
        try {
          const detailResponse = await fetch("/api/salons/" + encodeURIComponent(nextSalon.id));
          if (detailResponse.ok) {
            const detailPayload = await detailResponse.json();
            const detail = detailPayload.salon || detailPayload;
            if (detail && typeof detail === "object") {
              nextSalon = { ...nextSalon, ...detail };
            }
          }
        } catch {
          // keep the resolved salon from the list/directory
        }
      }

      setSelectedSalon(nextSalon);
      goToTab("salons");
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

  async function openExploreArtistProfile(post) {
    const artist = resolveExploreArtist(post);
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
      const ownStory = buildOwnStoryFields();
      if (ownStory) {
        setSelectedPublicArtist((current) => (current ? { ...current, ...ownStory } : current));
      }
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
      posts={savedExplorePosts}
      salons={savedProfiles.salons}
      artists={savedProfiles.artists}
      onSelectPost={selectExplorePost}
      onRemovePost={(item) => toggleSavedPost(item.title, item)}
      onSelectSalon={selectSalonWithStory}
      onRemoveSalon={removeSavedSalon}
      onSelectArtist={openPublicArtistProfile}
      onRemoveArtist={removeSavedArtist}
    />
  );

  const selectedExploreArtist = selectedPost ? resolveExploreArtist(selectedPost) : null;

  const selectSalonWithStory = async (salon) => {
    if (!salon) return;
    setSalonClientTab("gallery");
    setSelectedSalon(salon);
    try {
      const response = await fetch("/api/salons/" + encodeURIComponent(salon.id));
      if (response.ok) {
        const payload = await response.json();
        const detail = payload.salon || payload;
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

  // Hydrate the owner profile with persisted story fields (poster/video) from the server.
  useEffect(() => {
    if (!createdProfile?.id) return;
    let cancelled = false;
    fetch("/api/profile/story")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.story) return;
        const video = String(payload.story.video || "");
        const poster = String(payload.story.poster || "");
        if (!video && !poster) return;
        setCreatedProfile((current) => {
          if (!current) return current;
          return {
            ...current,
            data: {
              ...current.data,
              ...(video ? { storyVideo: video, story_video: video, introVideo: video, intro_video: video } : {}),
              ...(poster ? { storyPoster: poster, story_poster: poster, introPoster: poster, intro_poster: poster } : {})
            }
          };
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [createdProfile?.id]);


  return (
    <main className={`appShell ${!createdProfile ? "is-auth-gate" : ""} ${selectedSalon && activeTab === "salons" ? "is-salon-client" : ""} ${selectedPublicArtist ? "is-artist-public" : ""} ${!authChecked ? "is-auth-loading" : ""}`}>
      {!authChecked ? <AuthBootScreen /> : null}

      <section className="workspace">
        {!createdProfile ? (
          <div className="authGateBg" aria-hidden="true">
            <video
              className="authGateVideo"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/profile-icon.png"
              onLoadedMetadata={(event) => {
                event.currentTarget.playbackRate = 0.45;
              }}
              onPlay={(event) => {
                event.currentTarget.playbackRate = 0.45;
              }}
            >
              <source src="/auth-gate-bg.mp4" type="video/mp4" />
            </video>
            <span className="authGateScrim" />
          </div>
        ) : null}

        <section className="contentGrid">
          <ExplorePage
            active={activeTab === "feed"}
            exploreCategory={exploreCategory}
            posts={visibleExplorePosts}
            loading={exploreLoading}
            onCategoryChange={setExploreCategory}
            onPostSelect={selectExplorePost}
          />

          <SalonClientPage
            active={activeTab === "salons"}
            selectedSalon={selectedSalon}
            salons={salonDirectory}
            tab={salonClientTab}
            reviews={salonClientReviews}
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
            onSelectSalon={selectSalonWithStory}
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
          />
        )}

        <SalonClientFloatingDock
          open={activeTab === "salons" && Boolean(selectedSalon)}
          onBook={() => {
            setSalonClientTab("services");
            setAppToast("اول نوع خدمت را انتخاب کن.");
          }}
        />

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
                rating: artistSocialStats.rating,
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
                } else if (createdProfile?.type === "artist") {
                  setProfileView((prev) => (prev === "notifications" ? "overview" : "notifications"));
                }
              }}
              notificationCount={
                createdProfile?.type === "salon"
                  ? salonUnreadNoticeCount + recentlyExpiredSalonBookings.length
                  : createdProfile?.type === "artist"
                    ? pendingArtistBookingRequests.length + pendingArtistSalonInvites.length + recentlyExpiredArtistBookings.length
                    : 0
              }
              onOpenSettings={() => {
                if (createdProfile?.type === "salon") {
                  setSalonHeroSheet((prev) => (prev === "settings" ? null : "settings"));
                } else {
                  setProfileView((prev) => (prev === "settings" ? "overview" : "settings"));
                }
              }}
              onOpenWeekHistory={() => setSalonWeekHistoryOpen(true)}
              onSelectSalonWeekDay={setScheduleViewDay}
              selectedSalonWeekDay={activeScheduleDateKey}
              salonWeekTabs={salonHeroWeekTabs}
              showSalonWeekStrip={!salonWorkspace && profileView === "overview"}
              onShare={shareSalonOwnerProfile}
              showShare={createdProfile?.type === "salon"}
              onStorySave={saveProfileStory}
              onStoryDelete={deleteProfileStory}
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
            />

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
                          onCreateStaff={() => {
                            setArtistCreateRole(salonArtistRoleOptions[0]);
                            setArtistCreateStatus(salonArtistStatusOptions[0]);
                            setArtistCreateOpen(true);
                          }}
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
                          addLabel="افزودن پست جدید"
                          getFallbackStyle={getPortfolioCardStyle}
                          editingId={salonWorkDraft && salonWorkDraft.id !== "new" ? salonWorkDraft.id : null}
                          onItemClick={(item) => openPortfolioComposer(item)}
                          composeValue={salonWorkDraft}
                          onComposeChange={setSalonWorkDraft}
                          onComposeClose={resetPortfolioComposer}
                          onComposeSubmit={addSalonPortfolio}
                          onComposeDelete={deleteSalonPortfolioFromComposer}
                          onComposeImageUpload={handleSalonWorkImageUpload}
                          onComposeImageClear={clearSalonWorkImage}
                          composeTagOptions={salonWorkTagOptions}
                          composeVisibleTagOptions={salonWorkVisibleTagOptions}
                          composeTagMenuOpen={salonWorkTagMenuOpen}
                          onComposeTagMenuOpenChange={setSalonWorkTagMenuOpen}
                          composeSaving={portfolioSaving}
                          composeAriaLabel={salonWorkDraft?.id === "new" ? "پست جدید" : "ویرایش پست"}
                          composeSubmitLabel={salonWorkDraft?.id === "new" ? "انتشار در اکسپلور" : "ذخیره تغییرات"}
                          composeShowFeaturedToggle={false}
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
                      galleryTags={artistGalleryTags}
                      galleryFilter={artistGalleryFilter}
                      onGalleryFilterChange={setArtistGalleryFilter}
                      onAddWork={() => openArtistWorkModal({
                        id: "new",
                        title: "",
                        tag: "میکاپ",
                        caption: "",
                        image: "",
                        saves: "۰",
                        views: "۰",
                        rating: "",
                        inExplore: true,
                        featured: true
                      })}
                      onItemClick={openArtistWorkPreview}
                      composeValue={editingArtistWork}
                      onComposeChange={setEditingArtistWork}
                      onComposeClose={closeArtistWorkModal}
                      onComposeSubmit={saveArtistWork}
                      onComposeDelete={deleteArtistWork}
                      onComposeImageUpload={handleArtistWorkImageUpload}
                      onComposeImageClear={clearArtistWorkImage}
                      composeTagOptions={artistWorkTagOptions}
                      composeVisibleTagOptions={artistWorkVisibleTagOptions}
                      composeTagMenuOpen={artistWorkTagMenuOpen}
                      onComposeTagMenuOpenChange={setArtistWorkTagMenuOpen}
                      reviewSummary={artistReviewSummary}
                      reviews={artistReviewList}
                      artistAvatar={createdProfile?.data?.avatar || ""}
                      replyingReviewId={artistReplyingReviewId}
                      replyDraft={artistReplyDraft}
                      onReplyDraftChange={setArtistReplyDraft}
                      replySubmitting={artistReplySubmitting}
                      onOpenReply={openArtistReviewReply}
                      onCloseReply={closeArtistReviewReply}
                      onSubmitReply={submitArtistReviewReply}
                      onOpenReviewer={(review) => {
                        if (!review) return;
                        if (review.author_type === "artist" && review.author_user_id) {
                          openPublicArtistProfile({
                            id: review.author_user_id,
                            name: review.name,
                            avatar: review.author_avatar || ""
                          });
                          return;
                        }
                        setSelectedBookingClient({
                          id: review.author_user_id || null,
                          name: review.name || "کاربر",
                          avatar: review.author_avatar || "",
                          area: review.author_area || "",
                          type: review.author_type || "client",
                          kicker: "پروفایل نظردهنده",
                          bio: "",
                          phone: "",
                          bookingCount: 1,
                          bookings: [],
                          lastBooking: null
                        });
                      }}
                    />
                  ) : profileType === "client" ? (
                    <ClientProfileOverview
                      profile={createdProfile}
                      onEditProfile={openProfileEdit}
                      onOpenSaved={() => {
                        refreshSaves();
                        setProfileView("saved");
                      }}
                      profileSettings={profileSettings}
                      onToggleSetting={toggleProfileSetting}
                      onLogout={logoutAccount}
                      onDeleteAccount={deleteAccountPermanently}
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
          clientProfile={selectedBookingClient}
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

        <ProfileSettingsSheet
          open={Boolean(
            createdProfile && (
              (createdProfile.type === "salon" && salonHeroSheet === "settings")
              || (createdProfile.type !== "salon" && profileView === "settings")
            )
          )}
          profile={createdProfile}
          kicker={activeCreatedMeta?.kicker || "پروفایل"}
          locationSaving={profileLocationSaving}
          onSaveLocation={saveProfileLocation}
          onEditProfile={openProfileEdit}
          onClose={() => {
            if (createdProfile?.type === "salon") setSalonHeroSheet(null);
            else setProfileView("overview");
          }}
          profileSettings={profileSettings}
          onToggleSetting={toggleProfileSetting}
          artistBookingSettings={artistBookingSettings}
          onArtistBookingChange={setArtistBookingSettings}
          savedPostsCount={savedExplorePosts.length}
          savedSalonsCount={savedSalonList.length}
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
          onSelectHourDay={createdProfile?.type === "artist" ? setSelectedArtistHourDay : setSelectedSalonHourDay}
          onUpdateHour={createdProfile?.type === "artist" ? updateArtistHour : updateSalonHour}
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
                <span><UserRound size={18} /></span>
                <div>
                  <b>همکاری و پرسنل</b>
                  <small>{pendingSalonCollabRequests.length ? `${toPersianDigits(pendingSalonCollabRequests.length)} درخواست همکاری نیاز به پاسخ دارد.` : "درخواست همکاری تازه‌ای نداری."}</small>
                </div>
                <em>{toPersianDigits(pendingSalonCollabRequests.length)}</em>
              </article>
              <article>
                <span><CalendarClock size={18} /></span>
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
                            <span>{request.service}</span>
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
                          <span>{booking.service}</span>
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
                <span><UserRound size={18} /></span>
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
                            <span>{request.service}</span>
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
                          <span>{request.service}</span>
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
          booking={clientBookingSettings}
          onClose={() => setClientBookingSettings(null)}
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
          bookingSheetOpen={bookingSheetOpen}
          todayBookings={nearestArtistBookings}
          modeRail={
            createdProfile?.type === "salon" ? (
              <ProfileModeRail
                placement="dock"
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
            ) : null
          }
          onToggleBooking={() => {
            if (bookingSheetOpen) {
              closeBookingSheet();
              return;
            }
            openBookingSheet();
          }}
          onOpenBookings={() => {
            setProfileView("bookings");
            setArtistBookingRailOpen(false);
            setArtistBookingCreateOpen(false);
            closeBookingSheet();
          }}
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
                ? artistBookingDays
                : salonScheduleWeekTabs
                  .filter((tab) => {
                    const hour = salonHoursList.find((item) => item.day === tab.day);
                    return hour ? Boolean(hour.active) : true;
                  })
                  .map((tab) => ({
                    value: tab.dateKey,
                    label: `${tab.label} ${tab.sub || ""}`.trim()
                  }))
            }
            dayValue={
              createdProfile?.type === "artist"
                ? (artistBookingDays.includes(bookingDate) ? bookingDate : (artistBookingDays[0] || "امروز"))
                : bookingDateForSlots
            }
            onDayChange={setBookingDate}
            timeOptions={createdProfile?.type === "artist" ? artistAvailableSlots : bookingFreeSlots}
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
          onClose={() => {
            setArtistInviteOpen(false);
            setArtistInviteBusyId("");
          }}
          onInvite={inviteNearbyArtist}
        />

        <SalonCreateStaffModal
          open={artistCreateOpen}
          role={artistCreateRole}
          status={artistCreateStatus}
          roleOptions={salonArtistRoleOptions}
          statusOptions={salonArtistStatusOptions}
          onClose={() => setArtistCreateOpen(false)}
          onRoleChange={setArtistCreateRole}
          onStatusChange={setArtistCreateStatus}
          onSubmit={addSalonStaff}
        />
        <ProfileEditModal
          open={profileEditOpen && Boolean(createdProfile)}
          profile={createdProfile}
          avatarDraft={profileEditAvatar}
          onClose={() => { setProfileEditOpen(false); setProfileEditAvatar(""); }}
          onAvatarUpload={handleProfileAvatarUpload}
          onClearAvatar={() => setProfileEditAvatar("")}
          onSubmit={updateRegisteredProfile}
        />
        <ArtistWorkPreviewModal
          work={previewingArtistWork}
          onClose={closeArtistWorkPreview}
          onEdit={openArtistWorkModal}
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
          catalog={salonServiceCatalog}
          existingServices={activeServiceManagerList}
          onClose={closeArtistServiceCreate}
          onModeChange={setArtistServiceCreateMode}
          onDraftChange={(patch) => setArtistServiceDraft((prev) => ({ ...prev, ...patch }))}
          onSubmitCustom={addArtistService}
          onPickPreset={addArtistServicePreset}
        />
        {appToast && (
          <div className="appToast" role="status" aria-live="polite">
            <ShieldCheck size={17} />
            <span>{appToast}</span>
          </div>
        )}

        <BottomNav
          activeTab={activeTab}
          createdProfile={createdProfile}
          onTabChange={goToTab}
        />
        <PublicArtistModal
          artist={selectedPublicArtist}
          heroImage={publicArtistHeroImage}
          view={publicArtistView}
          portfolio={publicArtistPortfolio}
          services={publicArtistServices}
          reviews={publicArtistReviews}
          userRating={publicArtistUserRating}
          ratingHover={publicArtistRatingHover}
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
          onRatingHover={setPublicArtistRatingHover}
          onConfirmRating={confirmPublicArtistRating}
          onToggleReviewLike={toggleLikePublicArtistReview}
          viewerUserId={createdProfile?.id}
          onFollow={() => selectedPublicArtist && toggleFollowPublicArtist(selectedPublicArtist)}
          onViewChange={setPublicArtistView}
          onGalleryFilterChange={setPublicArtistGalleryFilter}
          onOpenWork={openPublicArtistWork}
          onSelectService={selectPublicArtistService}
          onBookingDayChange={setPublicArtistBookingDay}
          onBookingSlotChange={setPublicArtistBookingSlot}
          onConfirmBooking={confirmPublicArtistBooking}
          bookingBusy={publicArtistBookingBusy}
        />
        <ExplorePreviewModal
          post={selectedPost}
          exploreArtist={selectedExploreArtist}
          isSaved={selectedPostIsSaved}
          userRating={selectedPostUserRating}
          comments={selectedPostComments}
          beautyPassport={beautyPassport}
          passportMatch={selectedPost ? getPassportMatch(selectedPost) : ""}
          onClose={() => setSelectedPost(null)}
          onToggleSaved={() => selectedPost && toggleSavedPost(selectedPost.title, selectedPost)}
          onOpenRating={() => selectedPost && openExploreRatingPicker(selectedPost)}
          onShare={() => selectedPost && shareExplorePost(selectedPost)}
          onOpenArtistProfile={() => selectedPost && openExploreArtistProfile(selectedPost)}
        />
        <ExploreRatingModal
          picker={exploreRatingPicker}
          onClose={closeExploreRatingPicker}
          onHover={setExploreRatingHover}
          onConfirm={confirmExploreRating}
        />
      </section>
    </main>
  );
}
