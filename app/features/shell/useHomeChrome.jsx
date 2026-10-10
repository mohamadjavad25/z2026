import { useScheduleViews } from "./useScheduleViews";
import { useShellNavigation } from "./useShellNavigation";
import { ProfileModeRail } from "../profile/ProfileModeRail";
import { ProfileHeroWeekStrip } from "../profile/ProfileHeroWeekStrip";
import { SalonWeekStripDock } from "./SalonWeekStripDock";

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
  appToast,
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
