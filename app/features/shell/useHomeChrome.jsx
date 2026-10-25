import { useScheduleViews } from "./useScheduleViews";
import { useShellNavigation } from "./useShellNavigation";
import { ProfileModeRail } from "../profile/ProfileModeRail";
import { DayNav, useDaySwipe } from "../profile/DayNav";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { BACK_PRIORITY } from "../../shared/lib/backStack";

export function useHomeChrome({
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
}) {
  const {
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
    artistServiceList
  });

  const {
    getPassportMatch,
    getPortfolioCardStyle,
    refreshSaves,
    goToTab,
    rebookFromBooking,
    openPostOwnerProfile,
    openOwnPublicProfile,
    closeSelectedSalon,
    openConnectedProfile,
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


  // The phone's back button walks back through the screens instead of closing
  // the app (sheets register themselves through SheetClose): an open artist or
  // salon page closes first, then a profile view goes back to the overview, then
  // any other tab goes back to the profile tab, and only then does back leave.
  useBackHandler(Boolean(selectedPublicArtist), closePublicArtistProfile, BACK_PRIORITY.page);
  useBackHandler(Boolean(selectedSalon) && activeTab === "salons", closeSelectedSalon, BACK_PRIORITY.page);
  useBackHandler(
    Boolean(createdProfile) && activeTab === "profile" && (Boolean(salonWorkspace) || (profileView && profileView !== "overview")),
    () => {
      closeSalonWorkspace();
      setProfileView("overview");
    },
    BACK_PRIORITY.view
  );
  useBackHandler(Boolean(createdProfile) && activeTab !== "profile", () => goToTab("profile"), BACK_PRIORITY.tab);

  const profileModeRail = (
    <ProfileModeRail
      placement="panel"
      profileType={profileType}
      profileView={profileView}
      salonWorkspace={salonWorkspace}
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
  // The salon's day sits at the top of its bookings: the day before / after beside it, a swipe on the
  // day or on the list under it, and the full calendar from the day itself (DayNav, 2026-10-23).
  const salonDayNav = (
    <DayNav
      items={salonHeroWeekTabs}
      selectedDay={activeScheduleDateKey}
      onSelectDay={setScheduleViewDay}
      onOpenCalendar={() => setSalonWeekHistoryOpen(true)}
    />
  );
  const salonDaySwipe = useDaySwipe(salonHeroWeekTabs, activeScheduleDateKey, setScheduleViewDay);

  return {
    bookingCustomerOptions,
    selectedStaffStats,
    salonHistoryAppointments,
    activeScheduleDay,
    activeScheduleDayLabel,
    activeArtistScheduleDateKey,
    activeArtistScheduleDayLabel,
    artistBookingsWeekTabs,
    pendingArtistBookingRequests,
    recentlyExpiredSalonBookings,
    recentlyExpiredArtistBookings,
    scheduleDayAppointments,
    artistScheduleDayRows,
    getPassportMatch,
    getPortfolioCardStyle,
    refreshSaves,
    goToTab,
    rebookFromBooking,
    openPostOwnerProfile,
    openOwnPublicProfile,
    closeSelectedSalon,
    openConnectedProfile,
    openSalonStaffPublicProfile,
    shareSalonOwnerProfile,
    renderSavedPosts,
    setSalonPreviewWorkId,
    salonPreviewWork,
    selectedPostOwner,
    selectedPostSiblings,
    selectSalonWithDetail,
    profileModeRail,
    salonDayNav,
    salonDaySwipe
  };
}
