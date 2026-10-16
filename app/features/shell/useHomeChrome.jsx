import { useScheduleViews } from "./useScheduleViews";
import { useShellNavigation } from "./useShellNavigation";
import { ProfileModeRail } from "../profile/ProfileModeRail";
import { ProfileHeroWeekStrip } from "../profile/ProfileHeroWeekStrip";
import { SalonWeekStripDock } from "./SalonWeekStripDock";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { BACK_PRIORITY } from "../../shared/lib/backStack";

export function useHomeChrome({
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
}) {
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
    <SalonWeekStripDock items={salonHeroWeekTabs} selectedDay={activeScheduleDateKey}>
      <ProfileHeroWeekStrip
        items={salonHeroWeekTabs}
        selectedDay={activeScheduleDateKey}
        onSelectDay={setScheduleViewDay}
        onOpenHistory={() => setSalonWeekHistoryOpen(true)}
        ariaLabel="برنامه هفته سالن"
      />
    </SalonWeekStripDock>
  );

  return {
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
    salonWeekStripFloating
  };
}
