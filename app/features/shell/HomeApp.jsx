"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";
import { parseServiceDurationMinutes } from "../../shared/lib/time";
import {
  profileRoleMeta,
  salonArtistRoleOptions
} from "../../shared/constants/roles";
import { ArtistBreakEditorModal, ArtistWorkPreviewModal, PublicArtistModal, useArtistWorkspace, usePublicArtistProfile } from "../artist";
import { createLogoutUiGapResets, useAuthSession } from "../auth";
import {
  PostPreviewModal,
  mapSharedPost,
  usePostActivity
} from "../posts";
import { SettingsPage } from "../settings";
import { ClientBookingTracker } from "../client/ClientBookingTracker";
import { ClientBookingSettingsModal } from "../client";
import { ProfileHeroWeekStrip } from "../profile/ProfileHeroWeekStrip";
import { ProfileModeRail } from "../profile/ProfileModeRail";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceComposerModal } from "../profile/ServiceComposerModal";
import { SalonClientBookingModal, SalonClientPage, SalonCustomersPage, SalonNearbyInviteSheet, SalonStaffProfileModal, SalonToolSheets, useSalonDirectory, useSalonWorkspace, getVisibleSalonServiceItems } from "../salons";
import { ScheduleBookingMenuModal } from "../schedule";
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
import { pushNotificationsSupported, subscribeToPushNotifications } from "./homeAppHelpers";
import { ProfilePanelBody } from "./home/ProfilePanelBody";
import { SalonNotificationsSheet } from "./home/SalonNotificationsSheet";
import { ArtistNotificationsSheet } from "./home/ArtistNotificationsSheet";
import { ClientNotificationsSheet } from "./home/ClientNotificationsSheet";
import { OwnerBookingSheet } from "./home/OwnerBookingSheet";
import { PushSoftAsk } from "./home/PushSoftAsk";
import { useShellNavigation } from "./useShellNavigation";
import { useScheduleViews } from "./useScheduleViews";
import { useSalonDerived } from "./useSalonDerived";

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
          <ProfilePanelBody
          createdProfile={createdProfile}
          authMode={authMode}
          signupStep={signupStep}
          authNotice={authNotice}
          authBusy={authBusy}
          profileType={profileType}
          activeRoleMeta={activeRoleMeta}
          handleLoginSubmit={handleLoginSubmit}
          handleProfileSubmit={handleProfileSubmit}
          activeCreatedMeta={activeCreatedMeta}
          salonSocialStats={salonSocialStats}
          artistSocialStats={artistSocialStats}
          visibleArtistPortfolio={visibleArtistPortfolio}
          artistBookingList={artistBookingList}
          salonHeroSheet={salonHeroSheet}
          profileView={profileView}
          salonUnreadNoticeCount={salonUnreadNoticeCount}
          recentlyExpiredSalonBookings={recentlyExpiredSalonBookings}
          pendingArtistBookingRequests={pendingArtistBookingRequests}
          pendingArtistSalonInvites={pendingArtistSalonInvites}
          recentlyExpiredArtistBookings={recentlyExpiredArtistBookings}
          profileSettings={profileSettings}
          unseenClientBookingCount={unseenClientBookingCount}
          shareSalonOwnerProfile={shareSalonOwnerProfile}
          profileModeRail={profileModeRail}
          salonWorkspace={salonWorkspace}
          activeStaffCount={activeStaffCount}
          pendingSalonArtistInvites={pendingSalonArtistInvites}
          safeSalonStaffList={safeSalonStaffList}
          openNearbyArtistInvite={openNearbyArtistInvite}
          cancelSalonArtistInvite={cancelSalonArtistInvite}
          openSalonStaffPublicProfile={openSalonStaffPublicProfile}
          setSelectedArtistProfile={setSelectedArtistProfile}
          salonServiceList={salonServiceList}
          serviceArtistMenuId={serviceArtistMenuId}
          setServiceArtistMenuId={setServiceArtistMenuId}
          openSalonServiceCreate={openSalonServiceCreate}
          toggleSalonServiceArtist={toggleSalonServiceArtist}
          editArtistService={editArtistService}
          deleteSalonService={deleteSalonService}
          salonPortfolioList={salonPortfolioList}
          getPortfolioCardStyle={getPortfolioCardStyle}
          salonWorkDraft={salonWorkDraft}
          setSalonWorkDraft={setSalonWorkDraft}
          resetPortfolioComposer={resetPortfolioComposer}
          addSalonPortfolio={addSalonPortfolio}
          deleteSalonPortfolioFromComposer={deleteSalonPortfolioFromComposer}
          setAppToast={setAppToast}
          clearSalonWorkImage={clearSalonWorkImage}
          salonWorkTagOptions={salonWorkTagOptions}
          salonWorkTagMenuOpen={salonWorkTagMenuOpen}
          setSalonWorkTagMenuOpen={setSalonWorkTagMenuOpen}
          portfolioSaving={portfolioSaving}
          salonWorkspaceLoading={salonWorkspaceLoading}
          pendingSalonCollabRequests={pendingSalonCollabRequests}
          reservationRequestList={reservationRequestList}
          bookingDateForSlots={bookingDateForSlots}
          approveReservationRequest={approveReservationRequest}
          declineReservationRequest={declineReservationRequest}
          salonRequestBusyId={salonRequestBusyId}
          salonScheduleWeekTabs={salonScheduleWeekTabs}
          activeScheduleDay={activeScheduleDay}
          setScheduleViewDay={setScheduleViewDay}
          salonHistoryAppointments={salonHistoryAppointments}
          scheduleDayAppointments={scheduleDayAppointments}
          activeScheduleDayLabel={activeScheduleDayLabel}
          openScheduleBookingMenu={openScheduleBookingMenu}
          salonWeekHistoryOpen={salonWeekHistoryOpen}
          setSalonWeekHistoryOpen={setSalonWeekHistoryOpen}
          artistGalleryItems={artistGalleryItems}
          artistWorkspaceLoading={artistWorkspaceLoading}
          artistGalleryTags={artistGalleryTags}
          artistGalleryFilter={artistGalleryFilter}
          setArtistGalleryFilter={setArtistGalleryFilter}
          openArtistWorkPreview={openArtistWorkPreview}
          editingArtistWork={editingArtistWork}
          setEditingArtistWork={setEditingArtistWork}
          closeArtistWorkModal={closeArtistWorkModal}
          saveArtistWork={saveArtistWork}
          artistWorkSaving={artistWorkSaving}
          deleteArtistWork={deleteArtistWork}
          clearArtistWorkImage={clearArtistWorkImage}
          artistWorkTagOptions={artistWorkTagOptions}
          artistWorkTagMenuOpen={artistWorkTagMenuOpen}
          setArtistWorkTagMenuOpen={setArtistWorkTagMenuOpen}
          clientBookingList={clientBookingList}
          savedPosts={savedPosts}
          openProfileEdit={openProfileEdit}
          setClientBookingSettings={setClientBookingSettings}
          rebookFromBooking={rebookFromBooking}
          artistBreakTime={artistBreakTime}
          openArtistBreakEditor={openArtistBreakEditor}
          artistBookingsWeekTabs={artistBookingsWeekTabs}
          activeArtistScheduleDateKey={activeArtistScheduleDateKey}
          setArtistBookingSelectedDay={setArtistBookingSelectedDay}
          artistScheduleDayRows={artistScheduleDayRows}
          activeArtistScheduleDayLabel={activeArtistScheduleDayLabel}
          artistServiceList={artistServiceList}
          openArtistServiceCreate={openArtistServiceCreate}
          deleteArtistService={deleteArtistService}
          salonDirectory={salonDirectory}
          artistCollabOffers={artistCollabOffers}
          artistSalonInviteList={artistSalonInviteList}
          artistInviteRespondBusyId={artistInviteRespondBusyId}
          artistTeams={artistTeams}
          artistTeamBusyId={artistTeamBusyId}
          leaveArtistSalonTeam={leaveArtistSalonTeam}
          artistCollabDraft={artistCollabDraft}
          addArtistCollabOffer={addArtistCollabOffer}
          deleteArtistCollabOffer={deleteArtistCollabOffer}
          respondArtistSalonInvite={respondArtistSalonInvite}
          setProfileType={setProfileType}
          setSignupStep={setSignupStep}
          setAuthNotice={setAuthNotice}
          setAuthMode={setAuthMode}
          refreshSaves={refreshSaves}
          setSalonHeroSheet={setSalonHeroSheet}
          setProfileView={setProfileView}
          markClientBookingsSeen={markClientBookingsSeen}
          openPublicArtistProfile={openPublicArtistProfile}
          assignSalonServiceArtist={assignSalonServiceArtist}
          openPortfolioComposer={openPortfolioComposer}
          setSalonPreviewWorkId={setSalonPreviewWorkId}
          updateSalonCollabRequest={updateSalonCollabRequest}
          openArtistWorkModal={openArtistWorkModal}
          setArtistCollabDraft={setArtistCollabDraft}
        />

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

        <SalonNotificationsSheet
          createdProfile={createdProfile}
          salonHeroSheet={salonHeroSheet}
          reservationRequestList={reservationRequestList}
          pendingSalonCollabRequests={pendingSalonCollabRequests}
          salonAppointmentList={salonAppointmentList}
          recentlyExpiredSalonBookings={recentlyExpiredSalonBookings}
          setSalonHeroSheet={setSalonHeroSheet}
          salonRequestBusyId={salonRequestBusyId}
          approveReservationRequest={approveReservationRequest}
          declineReservationRequest={declineReservationRequest}
        />

        <ArtistNotificationsSheet
          createdProfile={createdProfile}
          profileView={profileView}
          pendingArtistBookingRequests={pendingArtistBookingRequests}
          pendingArtistSalonInvites={pendingArtistSalonInvites}
          artistBookingList={artistBookingList}
          recentlyExpiredArtistBookings={recentlyExpiredArtistBookings}
          setProfileView={setProfileView}
          artistRequestBusyId={artistRequestBusyId}
          confirmArtistBookingRequest={confirmArtistBookingRequest}
          declineArtistBookingRequest={declineArtistBookingRequest}
        />

        <ClientNotificationsSheet
          createdProfile={createdProfile}
          profileView={profileView}
          setProfileView={setProfileView}
          clientBookingList={clientBookingList}
        />

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
        <OwnerBookingSheet
          bookingSheetOpen={bookingSheetOpen}
          createdProfile={createdProfile}
          closeBookingSheet={closeBookingSheet}
          bookingCustomerOptions={bookingCustomerOptions}
          artistServiceList={artistServiceList}
          bookingServiceOptions={bookingServiceOptions}
          bookingServiceName={bookingServiceName}
          selectedBookingService={selectedBookingService}
          bookingSelectMenu={bookingSelectMenu}
          setBookingServiceName={setBookingServiceName}
          bookingStaffOptions={bookingStaffOptions}
          selectedBookingStaff={selectedBookingStaff}
          setBookingStaffName={setBookingStaffName}
          artistBookingDayOptions={artistBookingDayOptions}
          salonScheduleWeekTabs={salonScheduleWeekTabs}
          artistBookingDateForSlots={artistBookingDateForSlots}
          bookingDateForSlots={bookingDateForSlots}
          setBookingDate={setBookingDate}
          artistBookingFreeSlots={artistBookingFreeSlots}
          bookingFreeSlots={bookingFreeSlots}
          bookingTime={bookingTime}
          setBookingTime={setBookingTime}
          artistBookingSubmitting={artistBookingSubmitting}
          salonBookingSubmitting={salonBookingSubmitting}
          salonServiceList={salonServiceList}
          openArtistServiceCreate={openArtistServiceCreate}
          openSalonServiceCreate={openSalonServiceCreate}
          addSalonAppointment={addSalonAppointment}
          handleArtistBookingCreate={handleArtistBookingCreate}
          setBookingSelectMenu={setBookingSelectMenu}
          salonHoursList={salonHoursList}
        />
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

        <PushSoftAsk
          pushSoftAskVisible={pushSoftAskVisible}
          setPushSoftAskVisible={setPushSoftAskVisible}
        />

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
