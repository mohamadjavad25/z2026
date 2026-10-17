import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { clientBookingKey } from "../client/bookingStatus";
import { useAuthSession } from "../auth";
import { usePostActivity } from "../posts";
import { useSalonDirectory, useSalonWorkspace } from "../salons";
import { useArtistWorkspace } from "../artist";
import { apiFetch } from "../../shared/api/client";
import { notify } from "../../shared/notice/noticeStore";
import { pushNotificationsSupported, subscribeToPushNotifications } from "./homeAppHelpers";
import { useHomeChrome } from "./useHomeChrome";
import { useHomeWorkspaces } from "./useHomeWorkspaces";

export function useHomeApp() {
  const [activeTab, setActiveTab] = useState("profile");

  // Capture ?join={salonId} from a /join-salon/[id] QR/link redirect (guest
  // branch — see JoinSalonPageClient) before the auth gate renders, so the
  // pending join survives the login/signup round trip. Runs once, first
  // hook in the tree, so it always wins the race against useAuthSession's
  // own mount effect below. useAuthSession's onAuthenticated callback reads
  // this same key once a session exists (login/register/already-booted).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const joinSalonId = params.get("join");
    if (!joinSalonId) return;
    try {
      window.localStorage.setItem("frfro_pending_join_salon", JSON.stringify({ id: joinSalonId, code: params.get("k") || "" }));
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
  // Every top-of-screen notice goes through the shared store (app/shared/notice). Callers may still pass a string.
  const setAppToast = notify;
  const [pushSoftAskVisible, setPushSoftAskVisible] = useState(false);
  const [clientBookingSettings, setClientBookingSettings] = useState(null);
  // Right after a client books: the «درخواستت رسید» screen (features/client/BookingReceipt) and, on
  // their home, the booking that glows so they see where it went.
  const [bookingReceipt, setBookingReceipt] = useState(null);
  const [freshBookingKey, setFreshBookingKey] = useState("");
  const onClientBookedRef = useRef(null);
  const onClientBooked = useCallback((booking, extra) => onClientBookedRef.current?.(booking, extra), []);
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
    let pendingRaw = "";
    try {
      pendingRaw = window.localStorage.getItem("frfro_pending_join_salon") || "";
    } catch {
      return;
    }
    if (!pendingRaw) return;
    try {
      window.localStorage.removeItem("frfro_pending_join_salon");
    } catch {
      // ignore
    }
    // Older links (before the join code existed) stored a bare salon id string;
    // such a pending join has no code to offer and is simply dropped.
    let pendingSalonId = 0;
    let pendingCode = "";
    try {
      const parsed = JSON.parse(pendingRaw);
      pendingSalonId = Number(parsed?.id) || 0;
      pendingCode = String(parsed?.code || "");
    } catch {
      return;
    }
    if (!pendingSalonId) return;
    try {
      const { ok, payload } = await apiFetch("/api/artist/join-salon", {
        method: "POST",
        body: JSON.stringify({ salonUserId: pendingSalonId, code: pendingCode })
      });
      if (ok) {
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
          apiFetch("/api/beauty-passport").then(({ ok, payload }) => (ok ? payload : {})).catch(() => ({}))
        ]);
        setBeautyPassport(passportPayload.passport || passportPayload.data?.passport || null);
      } else if (source === "register") {
        await Promise.all([c.refreshSavedPosts?.(), c.refreshFollows?.(), c.refreshSaves?.()]);
      } else if (source === "boot") {
        const [passportPayload] = await Promise.all([
          apiFetch("/api/beauty-passport").then(({ ok, payload }) => (ok ? payload : {})).catch(() => ({})),
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
        !window.localStorage.getItem("frfro_push_soft_ask_dismissed")
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
    selectedSalon,
    setSelectedSalon,
    followedSalons,
    setFollowedSalons,
    savedSalonKeys,
    setSavedSalonKeys,
    salonClientTab,
    setSalonClientTab,
    salonClientBooking,
    clientBookingList,
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
    submitSalonClientVisit
  } = useSalonDirectory({
    createdProfile,
    onNotice: setAppToast,
    onShellNotice: setAppToast,
    onOwnerBookingsSync: (bookings) => applySalonBookingsRef.current?.(bookings, { bump: true }),
    onLinkedArtistBooked: (id) => notifyArtistBookingCreatedRef.current?.(id),
    onClientBooked
  });
  onClientBookedRef.current = (booking, { price = "", items = [] } = {}) => {
    if (createdProfile?.type !== "client" || !booking?.id) return;
    const key = clientBookingKey(booking);
    setBookingReceipt({ key, booking, price, items });
    setFreshBookingKey(key);
    if (booking.bookingSource === "artist") void refreshClientBookings();
  };
  // The new booking glows on the home page once, then it is an ordinary card.
  useEffect(() => {
    if (!freshBookingKey || bookingReceipt || activeTab !== "profile") return undefined;
    const timer = window.setTimeout(() => setFreshBookingKey(""), 6000);
    return () => window.clearTimeout(timer);
  }, [freshBookingKey, bookingReceipt, activeTab]);

  // Clients don't have a real-time "seen" flag from the server, so we track
  // which booking statuses the client has already looked at locally: a
  // {bookingId: status} snapshot in localStorage, scoped per account. A
  // booking counts as "unseen" when its current status differs from the
  // last snapshot taken (covers both "never seen this booking" and "status
  // changed since I last opened the panel"), for the 3 statuses worth
  // surfacing a notification for (pending doesn't need one — it's expected).
  const clientSeenStorageKey = createdProfile?.type === "client" && createdProfile?.id
    ? `frfro_client_seen_bookings_${createdProfile.id}`
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
    respondArtistSalonInvite,
    artistWorkspaceLoading
  } = useArtistWorkspace({
    createdProfile,
    activeTab,
    salonDirectory,
    onNotice: setAppToast,
    onShellNotice: setAppToast,
    onPostsChanged: () => refreshSavedPostsRef.current?.(),
    onCloseBookingSheet: () => setBookingSheetOpen(false)
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
    onCloseBookingSheet: () => setBookingSheetOpen(false),
    onLinkedArtistBooked: (id) => notifyArtistBookingCreatedRef.current?.(id),
    onArtistCollabOffersPatch: setArtistCollabOffers,
    onSalonDirectorySync: setSalonDirectory,
    onSelectedSalonSync: setSelectedSalon
  });
  applySalonBookingsRef.current = applySalonBookings;
  const homeWorkspacesState = useHomeWorkspaces({
    createdProfile,
    setCreatedProfile,
    setProfileType,
    setProfileView,
    setActiveTab,
    lockSession,
    writeAuthSession,
    setAppToast,
    followedArtists,
    setFollowedArtists,
    setFollowedSalons,
    openPost,
    notifyArtistBookingCreated,
    onClientBooked,
    artistServiceList,
    salonServiceList,
    upsertArtistOwnerService,
    upsertSalonOwnerService,
    artistBookingList,
    salonAppointmentList,
    setSelectedBookingClient,
    patchSalonAppointment,
    profileType,
    safeSalonStaffList,
    selectedStaffName,
    salonCollabRequestList,
    salonDirectory,
    salonPortfolioList,
    salonHoursList,
    setArtistBookingRailOpen,
    setArtistBookingCreateOpen,
    setSalonHeroSheet,
    setSalonToolSheetOpen,
    setSalonWorkspace,
    setClientBookingSettings,
    openSalonWorkspaceFromHook,
    setSelectedArtistProfile,
    setSelectedSalon
  });
  const {
    setProfileEditOpen,
    setProfileEditAvatar,
    profileSettings,
    openSalonWorkspace,
    selectedPublicArtist,
    publicArtistPortfolio,
    setSavedArtists,
    openPublicArtistProfile,
    closePublicArtistProfile,
    toggleSavePublicArtist,
    resetPublicArtistProfile,
    activeRoleMeta,
    salonScheduleWeekTabs,
    activeSalonHours,
    setBookingSheetOpen,
    resetLogoutUiGaps
  } = homeWorkspacesState;

  const homeChromeState = useHomeChrome({
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
    clientBookingList,
    setAppToast,
    salonStaffByName,
    scheduleNow,
    artistServiceList,
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
    activeTab,
    profileView,
    salonTool,
    salonWorkspace,
    selectedPublicArtist,
    selectedPost,
    beautyPassport,
    setFollowedArtists,
    setFollowedSalons,
    setSavedSalonKeys,
    setSavedProfiles,
    toggleSaveSalon,
    toggleSavePublicArtist,
    setScheduleNow,
    setActiveTab,
    salonDirectory,
    salonStaffList,
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
    publicArtistPortfolio,
    profileType,
    activeRoleMeta,
    openSalonWorkspace,
    setProfileView,
    setScheduleViewDay,
    closeSalonWorkspace,
    setSalonWeekHistoryOpen
  });


  return {
    ...homeChromeState,
    ...homeWorkspacesState,
    activeTab,
    setAppToast,
    pushSoftAskVisible,
    setPushSoftAskVisible,
    clientBookingSettings,
    setClientBookingSettings,
    bookingReceipt,
    setBookingReceipt,
    freshBookingKey,
    setFreshBookingKey,
    beautyPassport,
    setScheduleViewDay,
    salonWeekHistoryOpen,
    setSalonWeekHistoryOpen,
    authChecked,
    createdProfile,
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
    handleLoginSubmit,
    handleProfileSubmit,
    logoutAccount,
    deleteAccountPermanently,
    selectedPost,
    setSelectedPost,
    openPost,
    savedPosts,
    selectedPostIsSaved,
    savedPostTitles,
    recordPostView,
    toggleSavedPost,
    sharePost,
    salonDirectory,
    selectedSalon,
    setSelectedSalon,
    salonClientTab,
    setSalonClientTab,
    salonClientBooking,
    clientBookingList,
    isFollowingSelectedSalon,
    isSavedSelectedSalon,
    cancelClientBooking,
    answerClientTimeOffer,
    toggleFollowSalon,
    toggleSaveSalon,
    shareSalonProfile,
    openSalonClientBooking,
    closeSalonClientBooking,
    submitSalonClientVisit,
    unseenClientBookingCount,
    markClientBookingsSeen,
    artistSocialStats,
    artistSalonInviteList,
    artistInviteRespondBusyId,
    artistWorkSaving,
    artistTeams,
    artistTeamBusyId,
    leaveArtistSalonTeam,
    artistRequestBusyId,
    confirmArtistBookingRequest,
    declineArtistBookingRequest,
    artistGalleryFilter,
    setArtistGalleryFilter,
    setPreviewingArtistWorkId,
    editingArtistWork,
    setEditingArtistWork,
    artistWorkTagMenuOpen,
    setArtistWorkTagMenuOpen,
    artistBookingList,
    artistServiceList,
    artistBreakTime,
    artistBreakEditorOpen,
    artistBreakDraft,
    setArtistBreakDraft,
    artistBreakSaving,
    artistCollabOffers,
    artistCollabDraft,
    setArtistCollabDraft,
    setArtistBookingSelectedDay,
    artistHoursList,
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
    pendingArtistSalonInvites,
    submitArtistVisit,
    openArtistBreakEditor,
    closeArtistBreakEditor,
    saveArtistBreakTime,
    clearArtistBreakTime,
    deleteArtistService,
    addArtistCollabOffer,
    deleteArtistCollabOffer,
    openArtistWorkPreview,
    closeArtistWorkPreview,
    openArtistWorkModal,
    closeArtistWorkModal,
    clearArtistWorkImage,
    saveArtistWork,
    deleteArtistWork,
    respondArtistSalonInvite,
    artistWorkspaceLoading,
    salonTool,
    salonWorkspace,
    salonHeroSheet,
    setSalonHeroSheet,
    salonToolSheetOpen,
    settingsHoursOpen,
    setSettingsHoursOpen,
    salonAppointmentList,
    reservationRequestList,
    salonServiceList,
    salonPortfolioList,
    salonHoursList,
    setSelectedSalonHourDay,
    selectedArtistProfile,
    setSelectedArtistProfile,
    selectedBookingClient,
    setSelectedBookingClient,
    artistInviteOpen,
    setArtistInviteOpen,
    nearbyArtists,
    nearbyArtistsLoading,
    artistInviteBusyId,
    setArtistInviteBusyId,
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
    pendingSalonArtistInvites,
    pendingSalonCollabRequests,
    salonUnreadNoticeCount,
    closeSalonToolSheet,
    submitSalonVisit,
    approveReservationRequest,
    declineReservationRequest,
    updateSalonCollabRequest,
    openNearbyArtistInvite,
    inviteNearbyArtist,
    cancelSalonArtistInvite,
    updateSalonStaff,
    removeSalonStaff,
    joinSalonTeamAsOwner,
    updateSalonHour,
    updateSalonHoursPreset,
    copySalonHourToOpenDays,
    assignSalonServiceArtist,
    toggleSalonServiceArtist,
    deleteSalonService,
    resetPortfolioComposer,
    openPortfolioComposer,
    clearSalonWorkImage,
    addSalonPortfolio,
    deleteSalonPortfolioFromComposer,
    salonWorkspaceLoading
  };
}
