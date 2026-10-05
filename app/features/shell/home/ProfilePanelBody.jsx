import { AuthGateForms } from "../../auth";
import { ProfileHero } from "../../profile/ProfileHero";
import { ProfileCompleteness } from "../../profile/ProfileCompleteness";
import { SalonStaffWorkspace, SalonServicesWorkspace } from "../../salons";
import { ProfileGallery } from "../../profile/ProfileGallery";
import { SalonScheduleDashboard, ArtistScheduleBoard } from "../../schedule";
import { ArtistOverviewReviews, ArtistServicesPanel, ArtistCollabBoard } from "../../artist";
import { ClientProfileOverview, ClientBookingsPanel } from "../../client";

import { useHome } from "../HomeContext";
export function ProfilePanelBody() {
  const {
    createdProfile,
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
    deleteSalonService,
    salonPortfolioList,
    getPortfolioCardStyle,
    salonWorkDraft,
    setSalonWorkDraft,
    resetPortfolioComposer,
    addSalonPortfolio,
    deleteSalonPortfolioFromComposer,
    setAppToast,
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
    savedPosts,
    openProfileEdit,
    openSalonWorkspace,
    setClientBookingSettings,
    rebookFromBooking,
    artistBreakTime,
    openArtistBreakEditor,
    artistBookingsWeekTabs,
    activeArtistScheduleDateKey,
    setArtistBookingSelectedDay,
    artistScheduleDayRows,
    activeArtistScheduleDayLabel,
    artistServiceList,
    openArtistServiceCreate,
    deleteArtistService,
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
    openPublicArtistProfile,
    assignSalonServiceArtist,
    openPortfolioComposer,
    setSalonPreviewWorkId,
    updateSalonCollabRequest,
    openArtistWorkModal,
    setArtistCollabDraft
  } = useHome();

  return (
    (!createdProfile ? (
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
              modeRail={createdProfile?.type === "salon" ? profileModeRail : null}
            />

            {createdProfile?.type !== "salon" && profileModeRail}

            {(createdProfile?.type === "salon" || createdProfile?.type === "artist") && createdProfile.type === profileType && profileView === "overview" && !salonWorkspace ? (
              <ProfileCompleteness
                profile={createdProfile}
                serviceCount={createdProfile.type === "salon" ? salonServiceList.length : artistServiceList.length}
                onEditProfile={openProfileEdit}
                onOpenServices={() => (createdProfile.type === "salon" ? openSalonWorkspace("services") : setProfileView("services"))}
              />
            ) : null}

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
                  ) : profileType === "client" ? (
                    <ClientProfileOverview
                      profile={createdProfile}
                      bookings={clientBookingList}
                      savedCount={savedPosts.length}
                      onEditProfile={openProfileEdit}
                      onOpenSaved={() => {
                        refreshSaves();
                        setProfileView("saved");
                      }}
                      onOpenBookings={() => setProfileView("bookings")}
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
                  teams={artistTeams}
                  teamBusyId={artistTeamBusyId}
                  onLeaveTeam={leaveArtistSalonTeam}
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
          )) || null
  );
}
