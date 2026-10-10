"use client";

import { getVisibleSalonServiceItems, SalonCustomersPage, SalonClientPage } from "../../salons";
import { mapSharedPost } from "../../posts";
import { SettingsPage } from "../../settings";
import { useHome } from "../HomeContext";

export function ContentPages() {
  const {
    activeTab,
    createdProfile,
    profileLocationSaving,
    saveProfileLocation,
    openProfileEdit,
    logoSaving,
    posterSaving,
    saveProfileLogo,
    saveProfilePoster,
    removeProfileLogo,
    removeProfilePoster,
    setAppToast,
    saveAvatarPosition,
    savePosterPosition,
    pendingAvatarUpload,
    pendingPosterUpload,
    confirmAvatarUpload,
    confirmPosterUpload,
    cancelAvatarUpload,
    cancelPosterUpload,
    profileSettings,
    toggleProfileSetting,
    savedPosts,
    logoutAccount,
    deleteAccountPermanently,
    settingsHoursOpen,
    artistHoursPresets,
    salonHoursPresets,
    activeArtistHoursPreset,
    activeHoursPreset,
    activeArtistHoursPresetMeta,
    activeHoursPresetMeta,
    artistHoursList,
    salonHoursList,
    selectedArtistHour,
    selectedSalonHour,
    artistHourTimeOptions,
    salonHourTimeOptions,
    openArtistHoursDaysCount,
    activeSalonHours,
    weeklyArtistCapacityTotal,
    weeklyCapacityTotal,
    updateArtistHoursPreset,
    updateSalonHoursPreset,
    copyArtistHourToOpenDays,
    copySalonHourToOpenDays,
    setSelectedArtistHourDay,
    setSelectedSalonHourDay,
    updateArtistHour,
    updateSalonHour,
    salonAppointmentList,
    artistBookingList,
    selectedSalon,
    salonDirectory,
    sharePost,
    recordPostView,
    salonDirectoryLoading,
    salonClientTab,
    isFollowingSelectedSalon,
    isSavedSelectedSalon,
    getPortfolioCardStyle,
    toggleFollowSalon,
    toggleSaveSalon,
    shareSalonProfile,
    setSalonClientTab,
    openSalonClientBooking,
    selectSalonWithDetail,
    setSalonHeroSheet,
    setProfileView,
    setSettingsHoursOpen,
    savedPostTitles,
    toggleSavedPost,
    closeSelectedSalon
  } = useHome();

  return (
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
            onBack={closeSelectedSalon}
            onFollow={toggleFollowSalon}
            onSave={toggleSaveSalon}
            onShare={shareSalonProfile}
            onTabChange={setSalonClientTab}
            onOpenBooking={openSalonClientBooking}
            onSelectSalon={selectSalonWithDetail}
          />
        </section>
  );
}
