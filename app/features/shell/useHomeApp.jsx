import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { onBookElsewhere } from "../booking/rebookBus";
import { clientBookingKey } from "../client/bookingStatus";
import { useAuthSession } from "../auth";
import { usePostActivity } from "../posts";
import { useOwnerFollowers, useSalonDirectory, useSalonWorkspace } from "../salons";
import { getVisibleSalonServiceItems } from "../salons/useSalonDirectory";
import { useContinueService } from "../follow/useContinueService";
import { useArtistWorkspace } from "../artist";
import { apiFetch } from "../../shared/api/client";
import { notify } from "../../shared/notice/noticeStore";
import { startPushOrAsk } from "./homeAppHelpers";
import { useArrival } from "./useArrival";
import { useClientBookingsSeen } from "./useClientBookingsSeen";
import { trackScreen } from "../../shared/lib/activity";
import { useHomeChrome } from "./useHomeChrome";
import { useHomeWorkspaces } from "./useHomeWorkspaces";
import { nowDate } from "../../shared/lib/clock.js";

export function useHomeApp() {
  const [activeTab, setActiveTab] = useState("profile");
  useEffect(() => {
    trackScreen(`tab:${activeTab}`);
  }, [activeTab]);

  const continueServiceRef = useRef(null);
  const refreshSavedPostsRef = useRef(null);
  const refreshArtistWorkspaceRef = useRef(null);
  const notifyArtistBookingCreatedRef = useRef(null);
  const applySalonBookingsRef = useRef(null);
  const authCascadeRef = useRef({});
  // Every top-of-screen notice goes through the shared store (app/shared/notice). Callers may still pass a string.
  const setAppToast = notify;
  // A join link or a public page's «رزرو», kept through sign-up (useArrival.js).
  const { arrivalIntent, tryJoinPendingSalon, tryOpenPendingPlace, tryClaimPendingRequest } = useArrival({ setAppToast, setActiveTab, authCascadeRef, continueServiceRef });
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
  const [scheduleNow, setScheduleNow] = useState(() => nowDate());

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

      // From a client's request SMS link: take the waiting requests first, so the lists below already show them.
      await tryClaimPendingRequest(profile);
      if (profile?.type === "salon") await c.refreshSalonSystemData?.();
      if (profile?.type === "artist") {
        await c.refreshArtistWorkspace?.();
        await tryJoinPendingSalon(profile);
      }
      if (source === "boot" && profile?.type === "client") await c.refreshClientBookings?.();
      await tryOpenPendingPlace(profile);
      startPushOrAsk(setPushSoftAskVisible);
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

  // A guest who came to book with a place or to join a salon's team goes straight to the right sign-up
  // form (client / artist), not the role picker. Only once, and only for a fresh sign-up (a returning
  // visitor sees the login form, which is right for them).
  const arrivalFormShownRef = useRef(false);
  useEffect(() => {
    if (!authChecked || createdProfile || !arrivalIntent || arrivalFormShownRef.current) return;
    arrivalFormShownRef.current = true;
    // From a client's request SMS: salon or artist is theirs to pick, so the role picker stays.
    if (authMode !== "signup" || arrivalIntent.kind === "request") return;
    setProfileType(arrivalIntent.kind === "join" ? "artist" : "client");
    setSignupStep("form");
  }, [authChecked, createdProfile, arrivalIntent, authMode, setProfileType, setSignupStep]);

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
    answerClientProposal,
    confirmClientAttendance,
    clientRecord,
    clientWaitlist,
    setClientWaitlist,
    leaveClientWaitlist,
    resetSalonClient,
    toggleFollowSalon,
    toggleSaveSalon,
    shareSalonProfile,
    openSalonClientBooking,
    openSalonClientBookingPrefilled,
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
  // «همین نوبت را جای دیگر بگیر» (features/client/ExpiredRequestActions): open the chosen place with the request filled in.
  const prefilledOpenerRef = useRef(null);
  prefilledOpenerRef.current = openSalonClientBookingPrefilled;
  useEffect(() => onBookElsewhere(async ({ place, prefill }) => {
    if (!place?.id) return;
    setActiveTab("salons");
    // The form opens only once the place's own page (with its services) is loaded: the form keeps the services it starts with.
    await authCascadeRef.current.openConnectedProfile?.({ ...place, type: "salon" });
    prefilledOpenerRef.current?.(prefill);
  }), []);
  // A guest's ticked service survives sign-up: the salon page opens with the booking form on it (features/follow/useContinueService).
  const continueService = useContinueService({ selectedSalon, openBooking: openSalonClientBooking, getServices: getVisibleSalonServiceItems });
  continueServiceRef.current = continueService;
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

  const { unseenClientBookingCount, markClientBookingsSeen } = useClientBookingsSeen(createdProfile, clientBookingList);

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
    markArtistNoShow,
    proposeArtistBookingTime,
    withdrawArtistProposal,
    cancelArtistConfirmedBooking,
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
    openArtistHoursDaysCount,
    saveArtistHoursWeek,
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
    startArtistBreakNow,
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

  // Followers are contacts: the customers page lists them and its nav button shows a dot while new.
  const { followers: ownerFollowers, unseenCount: unseenFollowerCount, refreshFollowers: refreshOwnerFollowers } = useOwnerFollowers({
    enabled: createdProfile?.type === "salon" || createdProfile?.type === "artist",
    pageOpen: activeTab === "customers"
  });

  return {
    arrivalIntent,
    ownerFollowers,
    refreshOwnerFollowers,
    unseenFollowerCount,
    ...homeChromeState,
    ...homeWorkspacesState,
    // Screens refresh right after an action with these (accepting a join request, a scanned code, an invite). They
    // were missing here, so every `refresh…?.()` in the home screens did nothing and the screen waited for the next
    // poll or a reload (owner's report 2026-10-30).
    refreshSalonSystemData,
    refreshArtistWorkspace,
    setSalonCollabRequestList,
    setSalonStaffList,
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
    answerClientProposal,
    confirmClientAttendance,
    clientRecord,
    clientWaitlist,
    setClientWaitlist,
    leaveClientWaitlist,
    toggleFollowSalon,
    toggleSaveSalon,
    shareSalonProfile,
    openSalonClientBooking,
    closeSalonClientBooking,
    submitSalonClientVisit,
    continueService,
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
    markArtistNoShow,
    proposeArtistBookingTime,
    withdrawArtistProposal,
    cancelArtistConfirmedBooking,
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
    openArtistHoursDaysCount,
    saveArtistHoursWeek,
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
    startArtistBreakNow,
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
    saveSalonHoursWeek,
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
