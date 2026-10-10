"use client";

import { getVisibleSalonServiceItems, SalonCustomersPage, SalonClientPage } from "../../salons";
import { mapSharedPost } from "../../posts";
import { SettingsPage } from "../../settings";
import { ConnectPage, OwnerScanButton } from "../../connect";
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
    refreshSalonSystemData,
    refreshArtistWorkspace,
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
    sharePost,
    recordPostView,
    salonClientTab,
    isFollowingSelectedSalon,
    isSavedSelectedSalon,
    getPortfolioCardStyle,
    toggleFollowSalon,
    toggleSaveSalon,
    shareSalonProfile,
    setSalonClientTab,
    openSalonClientBooking,
    openConnectedProfile,
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
              headerAction={<OwnerScanButton viewerType="salon" onChanged={() => refreshSalonSystemData?.()} />}
            />
          )}

          {createdProfile?.type === "artist" && (
            <SalonCustomersPage
              active={activeTab === "customers"}
              bookings={artistBookingList}
              ownerLabel="شما"
              headerAction={<OwnerScanButton viewerType="artist" onChanged={() => refreshArtistWorkspace?.()} />}
            />
          )}

          <SalonClientPage
            active={activeTab === "salons"}
            selectedSalon={selectedSalon}
            homeContent={createdProfile?.type === "client" ? (
              <ConnectPage
                me={{ name: createdProfile.data?.name || "", avatar: createdProfile.data?.avatar || "" }}
                onOpenProfile={openConnectedProfile}
                onNotify={setAppToast}
              />
            ) : null}
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
          />
        </section>
  );
}
