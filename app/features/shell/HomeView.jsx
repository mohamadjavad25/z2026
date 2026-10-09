"use client";

import { SalonClientBookingModal, SalonToolSheets, SalonStaffProfileModal, SalonNearbyInviteSheet } from "../salons";
import { salonInventory, salonTasks } from "./mockData";
import { salonArtistRoleOptions } from "../../shared/constants/roles";
import { SERVICE_CATALOG } from "../../shared/constants/serviceCatalog";
import { createPortal } from "react-dom";
import { PostPreviewModal } from "../posts";
import { NetworkBusyBar } from "../../components/NetworkBusyBar";
import { AuthBootScreen } from "./AuthBootScreen";
import { ProfilePanelBody } from "./home/ProfilePanelBody";
import { SalonNotificationsSheet } from "./home/SalonNotificationsSheet";
import { ArtistNotificationsSheet } from "./home/ArtistNotificationsSheet";
import { ClientNotificationsSheet } from "./home/ClientNotificationsSheet";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ClientBookingSettingsModal } from "../client";
import { MobileFloatingCta } from "./MobileFloatingCta";
import { ClientProfileModal } from "./ClientProfileModal";
import { OwnerBookingSheet } from "./home/OwnerBookingSheet";
import { ProfileEditModal } from "./ProfileEditModal";
import { ArtistWorkPreviewModal, ArtistBreakEditorModal } from "../artist";
import { ServiceComposerModal } from "../profile/ServiceComposerModal";
import { ShieldCheck } from "lucide-react";
import { PushSoftAsk } from "./home/PushSoftAsk";
import { ClientBookingTracker } from "../client/ClientBookingTracker";
import { BottomNav } from "./BottomNav";
import { SupportFab } from "../support";
import { useHome } from "./HomeContext";
import { PublicArtistHost } from "./home/PublicArtistHost";
import { ScheduleMenuHost } from "./home/ScheduleMenuHost";
import { ContentPages } from "./home/ContentPages";


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

export function HomeView() {
  const {
    createdProfile,
    selectedSalon,
    activeTab,
    selectedPublicArtist,
    authChecked,
    openProfileEdit,
    setAppToast,
    sharePost,
    salonClientBooking,
    salonClientFreeTimes,
    salonClientBookingBusy,
    closeSalonClientBooking,
    patchSalonClientBooking,
    confirmSalonClientBooking,
    profileType,
    activeCreatedMeta,
    salonHeroSheet,
    profileView,
    salonWorkspace,
    openSalonStaffPublicProfile,
    setSelectedArtistProfile,
    salonPortfolioList,
    artistGalleryItems,
    clientBookingList,
    setClientBookingSettings,
    rebookFromBooking,
    artistBreakTime,
    setSalonHeroSheet,
    setProfileView,
    openPortfolioComposer,
    setSalonPreviewWorkId,
    openArtistWorkModal,
    scheduleBookingMenu,
    renderSavedPosts,
    clientBookingSettings,
    cancelClientBooking,
    salonWeekStripFloating,
    salonToolSheetOpen,
    salonTool,
    closeSalonToolSheet,
    selectedArtistProfile,
    selectedStaffStats,
    selectedBookingClient,
    bookingSheetOpen,
    closeBookingSheet,
    artistInviteOpen,
    nearbyArtistsLoading,
    nearbyArtists,
    artistInviteBusyId,
    inviteNearbyArtist,
    profileEditOpen,
    profileEditAvatar,
    handleProfileAvatarUpload,
    updateRegisteredProfile,
    profileSaving,
    salonPreviewWork,
    previewingArtistWork,
    closeArtistWorkPreview,
    artistBreakEditorOpen,
    artistBreakDraft,
    artistBreakSaving,
    setArtistBreakDraft,
    saveArtistBreakTime,
    clearArtistBreakTime,
    closeArtistBreakEditor,
    artistServiceCreateOpen,
    artistServiceCreateMode,
    artistServiceDraft,
    activeServiceManagerList,
    closeArtistServiceCreate,
    setArtistServiceCreateMode,
    addArtistService,
    addArtistServicePreset,
    customizeServicePreset,
    appToast,
    goToTab,
    selectedPost,
    selectedPostSiblings,
    openPost,
    selectedPostOwner,
    selectedPostIsSaved,
    beautyPassport,
    getPassportMatch,
    toggleSavedPost,
    updateSalonStaff,
    removeSalonStaff,
    setSelectedBookingClient,
    setArtistInviteOpen,
    setArtistInviteBusyId,
    setProfileEditOpen,
    setProfileEditAvatar,
    setPreviewingArtistWorkId,
    setArtistServiceDraft,
    openBookingSheet,
    setSelectedPost,
    openPostOwnerProfile
  } = useHome();

  return (
    <main className={`appShell ${!createdProfile ? "is-auth-gate" : ""} ${selectedSalon && activeTab === "salons" ? "is-salon-client" : ""} ${selectedPublicArtist ? "is-artist-public" : ""} ${!authChecked ? "is-auth-loading" : ""}`}>
      <h1 className="srOnly">Farfaroo</h1>
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

        <ContentPages />

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
          <ProfilePanelBody />

        </section>

        <ScheduleMenuHost />

        <SalonNotificationsSheet />

        <ArtistNotificationsSheet />

        <ClientNotificationsSheet />

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
        <OwnerBookingSheet />
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
            role: "سالن",
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

        <PushSoftAsk />

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
        {createdProfile && activeTab === "profile" && !selectedPublicArtist ? <SupportFab /> : null}
        <PublicArtistHost />
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
