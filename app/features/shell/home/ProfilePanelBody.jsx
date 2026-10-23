import { useState } from "react";
import { AuthGateForms } from "../../auth";
import { ProfileHero } from "../../profile/ProfileHero";
import { openLocationSettings } from "../../profile/locationEvents";
import { ProfileCompleteness } from "../../profile/ProfileCompleteness";
import { BillingBanner } from "../../billing";
import { SalonStaffWorkspace, SalonServicesWorkspace } from "../../salons";
import { ProfileGallery } from "../../profile/ProfileGallery";
import { SalonScheduleDashboard, ArtistScheduleBoard } from "../../schedule";
import { ArtistOverviewReviews, ArtistServicesPanel, ArtistCollabBoard } from "../../artist";
import { ClientHome } from "../../client";
import { ScanFlow } from "../../connect";

import { useHome } from "../HomeContext";
export function ProfilePanelBody() {
  const {
    createdProfile,
    salonDayNav,
    salonDaySwipe,
    arrivalIntent,
    authMode,
    signupStep,
    authNotice,
    authBusy,
    profileType,
    activeRoleMeta,
    handleLoginSubmit,
    handleProfileSubmit,
    activeCreatedMeta,
    salonSocialStats,
    artistSocialStats,
    visibleArtistPortfolio,
    artistBookingList,
    salonHeroSheet,
    profileView,
    salonUnreadNoticeCount,
    recentlyExpiredSalonBookings,
    pendingArtistBookingRequests,
    artistRequestBusyId,
    confirmArtistBookingRequest,
    declineArtistBookingRequest,
    pendingArtistSalonInvites,
    recentlyExpiredArtistBookings,
    profileSettings,
    unseenClientBookingCount,
    shareSalonOwnerProfile,
    profileModeRail,
    salonWorkspace,
    activeStaffCount,
    pendingSalonArtistInvites,
    safeSalonStaffList,
    joinSalonTeamAsOwner,
    removeSalonStaff,
    openNearbyArtistInvite,
    cancelSalonArtistInvite,
    openSalonStaffPublicProfile,
    setSelectedArtistProfile,
    salonServiceList,
    serviceArtistMenuId,
    setServiceArtistMenuId,
    openSalonServiceCreate,
    toggleSalonServiceArtist,
    editArtistService,
    salonPortfolioList,
    getPortfolioCardStyle,
    salonWorkDraft,
    setSalonWorkDraft,
    resetPortfolioComposer,
    addSalonPortfolio,
    deleteSalonPortfolioFromComposer,
    setAppToast,
    refreshSalonSystemData,
    refreshArtistWorkspace,
    clearSalonWorkImage,
    salonWorkTagOptions,
    salonWorkTagMenuOpen,
    setSalonWorkTagMenuOpen,
    portfolioSaving,
    salonWorkspaceLoading,
    pendingSalonCollabRequests,
    reservationRequestList,
    bookingDateForSlots,
    approveReservationRequest,
    declineReservationRequest,
    salonRequestBusyId,
    salonScheduleWeekTabs,
    activeScheduleDay,
    setScheduleViewDay,
    salonHistoryAppointments,
    scheduleDayAppointments,
    activeScheduleDayLabel,
    openScheduleBookingMenu,
    salonWeekHistoryOpen,
    setSalonWeekHistoryOpen,
    artistGalleryItems,
    artistWorkspaceLoading,
    artistGalleryTags,
    artistGalleryFilter,
    setArtistGalleryFilter,
    openArtistWorkPreview,
    editingArtistWork,
    setEditingArtistWork,
    closeArtistWorkModal,
    saveArtistWork,
    artistWorkSaving,
    deleteArtistWork,
    clearArtistWorkImage,
    artistWorkTagOptions,
    artistWorkTagMenuOpen,
    setArtistWorkTagMenuOpen,
    clientBookingList,
    openSalonWorkspace,
    saveProfileLogo,
    pendingAvatarUpload,
    quickSaveProfile,
    setClientBookingSettings,
    rebookFromBooking,
    goToTab,
    openConnectedProfile,
    freshBookingKey,
    artistBreakTime,
    openArtistBreakEditor,
    artistBookingsWeekTabs,
    activeArtistScheduleDateKey,
    setArtistBookingSelectedDay,
    artistScheduleDayRows,
    activeArtistScheduleDayLabel,
    artistServiceList,
    openArtistServiceCreate,
    salonDirectory,
    artistCollabOffers,
    artistSalonInviteList,
    artistInviteRespondBusyId,
    artistTeams,
    artistTeamBusyId,
    leaveArtistSalonTeam,
    artistCollabDraft,
    addArtistCollabOffer,
    deleteArtistCollabOffer,
    respondArtistSalonInvite,
    setProfileType,
    setSignupStep,
    setAuthNotice,
    setAuthMode,
    refreshSaves,
    setSalonHeroSheet,
    setProfileView,
    markClientBookingsSeen,
    openOwnPublicProfile,
    assignSalonServiceArtist,
    openPortfolioComposer,
    setSalonPreviewWorkId,
    updateSalonCollabRequest,
    openArtistWorkModal,
    setArtistCollabDraft
  } = useHome();
  const [ownerScanOpen, setOwnerScanOpen] = useState(false);
  const ownerType = createdProfile?.type === "salon" || createdProfile?.type === "artist" ? createdProfile.type : "";

  return (
    (!createdProfile ? (
            <AuthGateForms
              authMode={authMode}
              signupStep={signupStep}
              authNotice={authNotice}
              arrivalIntent={arrivalIntent}
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
              onPreviewPublic={ownerType ? openOwnPublicProfile : undefined}
              onScan={ownerType ? () => setOwnerScanOpen(true) : undefined}
              onOpenLocation={() => { goToTab("settings"); openLocationSettings(); }}
              modeRail={createdProfile?.type === "salon" ? profileModeRail : null}
            />
            {ownerScanOpen && ownerType ? (
              <ScanFlow
                viewerType={ownerType}
                onChanged={() => (ownerType === "salon" ? refreshSalonSystemData?.() : refreshArtistWorkspace?.())}
                onClose={() => setOwnerScanOpen(false)}
              />
            ) : null}

            {/* A client's page is one page (ClientHome): no «پروفایل / فعالیت من» switch. */}
            {createdProfile?.type === "artist" && profileModeRail}

            {(createdProfile?.type === "salon" || createdProfile?.type === "artist") && createdProfile.type === profileType && profileView === "overview" && !salonWorkspace ? (
              <BillingBanner />
            ) : null}

            {/* Wait for the workspace to load: until then the service count reads 0 and a complete profile would flash the card. */}
            {(createdProfile?.type === "salon" || createdProfile?.type === "artist") && createdProfile.type === profileType && profileView === "overview" && !salonWorkspace
              && !(createdProfile.type === "salon" ? salonWorkspaceLoading : artistWorkspaceLoading) ? (
              <ProfileCompleteness
                profile={createdProfile}
                serviceCount={createdProfile.type === "salon" ? salonServiceList.length : artistServiceList.length}
                onPickLogo={saveProfileLogo}
                logoEditing={Boolean(pendingAvatarUpload)}
                onQuickSave={quickSaveProfile}
                onOpenServices={() => {
                  // Land on the services page and open the add-service sheet right away.
                  if (createdProfile.type === "salon") {
                    openSalonWorkspace("hours");
                    openSalonServiceCreate();
                  } else {
                    setProfileView("services");
                    openArtistServiceCreate();
                  }
                }}
              />
            ) : null}

          {createdProfile.type === profileType ? (
            <div className={`createdProfile ${activeRoleMeta.heroClass || ""}`}>
              {/* An artist's «نوبت‌ها» is the overview too (the schedule, below); their posts are the «portfolio» view. */}
              {(profileView === "overview" || (profileView === "portfolio" && profileType === "artist")) && (
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
                          managerName={createdProfile?.data?.managerName || ""}
                          onJoinAsOwner={joinSalonTeamAsOwner}
                          onLeaveAsOwner={removeSalonStaff}
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
                    <>
                    {/* The day picker sits above the day's list, not floating over it (2026-10-23). */}
                    <div className="salonDayInline">{salonDayNav}</div>
                    <div className="salonDaySwipe" {...salonDaySwipe}>
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
                    </div>
                    </>
                    )
                  ) : profileType === "artist" && profileView === "portfolio" ? (
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
                  ) : null}
                </>
              )}

              {profileType === "client" && (profileView === "overview" || profileView === "bookings") && (
                <ClientHome
                  bookings={clientBookingList}
                  highlightKey={freshBookingKey}
                  onOpenBooking={(booking) => setClientBookingSettings({ ...booking, clientBookingSheetMode: "details" })}
                  onRebook={rebookFromBooking}
                  clientName={createdProfile?.data?.name || ""}
                  clientAvatar={createdProfile?.data?.avatar || ""}
                  onOpenPlace={openConnectedProfile}
                  onFindPlaces={() => goToTab("salons")}
                  onNotify={setAppToast}
                />
              )}

              {(profileView === "overview" || profileView === "bookings") && profileType === "artist" && (
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
                  requests={pendingArtistBookingRequests}
                  requestBusyId={artistRequestBusyId}
                  onApproveRequest={confirmArtistBookingRequest}
                  onDeclineRequest={declineArtistBookingRequest}
                />
              )}

              {profileView === "services" && profileType === "artist" && (
                <ArtistServicesPanel
                  services={artistServiceList}
                  onCreate={openArtistServiceCreate}
                  onEdit={editArtistService}
                />
              )}

              {profileView === "collabs" && profileType === "artist" && (
                <ArtistCollabBoard
                  artistId={createdProfile?.id}
                  artistName={createdProfile?.data?.name || ""}
                  invites={artistSalonInviteList}
                  inviteRespondBusyId={artistInviteRespondBusyId}
                  teams={artistTeams}
                  teamBusyId={artistTeamBusyId}
                  onLeaveTeam={leaveArtistSalonTeam}
                  onInviteRespond={respondArtistSalonInvite}
                  onChanged={refreshArtistWorkspace}
                />
              )}

            </div>
          ) : null}
            </>
          )) || null
  );
}
