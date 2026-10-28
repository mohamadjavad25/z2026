"use client";

import { defaultAvatarFor, isDefaultAvatar } from "../../shared/lib/defaultAvatar";
import { useRef, useState } from "react";
import { Bookmark, Camera, ChevronLeft, ImagePlus, Move, Pencil, Plus, Trash2 } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ProfileLocationSettings } from "../profile/ProfileLocationSettings";
import { ProfileInstagramSettings } from "../profile/ProfileInstagramSettings";
import { AccountSettings } from "../profile/ProfileSettingsPanel";
import { SalonHoursEditor } from "../profile/SalonHoursEditor";
import { ImagePositionEditor } from "./ImagePositionEditor";
import { SalonRulesSettings } from "../salons/SalonRulesSettings";
import { SmsPackCard, SubscriptionCard } from "../billing";
import { ProfileProgress } from "./ProfileProgress";
import { profileTodos } from "./profileProgress";
import { AppearanceTile, ArtistBookingTile, NotificationsTile, PageLinkTile, TileSlot, VisibilityTile } from "./SettingsTiles";

/**
 * The camera-icon trigger over an existing avatar/poster opens a bottom
 * action sheet (تغییر / تنظیم تصویر / حذف). It is portaled, so the parent
 * card's overflow can never clip it (an inline dropdown was cut off by the
 * poster band). With no image yet the trigger just opens the file picker.
 */
function ImageEditMenu({ hasImage, busy, title, triggerClassName, triggerLabel, triggerIcon, onPickFile, onReposition, onRemove }) {
  const [open, setOpen] = useState(false);

  if (!hasImage) {
    return (
      <button type="button" className={triggerClassName} onClick={onPickFile} disabled={busy} aria-label={triggerLabel || title}>
        {triggerIcon}
        {triggerLabel}
      </button>
    );
  }

  function run(action) {
    setOpen(false);
    action();
  }

  return (
    <div className="imageEditMenu">
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
        disabled={busy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={triggerLabel || title}
      >
        {triggerIcon}
        {busy ? "دارم ذخیره می‌کنم…" : triggerLabel}
      </button>
      <ProfileSheet
        open={open}
        kicker="تصویر پروفایل"
        title={title}
        label={title}
        panelClassName="imageActionSheet"
        onClose={() => setOpen(false)}
      >
        <div className="imageActionList" role="menu">
          <button type="button" role="menuitem" onClick={() => run(onPickFile)}>
            <span><Camera size={17} aria-hidden="true" /></span>
            <b>یه عکس تازه</b>
            <small>از گالری یا دوربین</small>
          </button>
          <button type="button" role="menuitem" onClick={() => run(onReposition)}>
            <span><Move size={17} aria-hidden="true" /></span>
            <b>قابش رو درست کن</b>
            <small>جابه‌جا و بزرگ‌کوچیک کن</small>
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => run(onRemove)}>
            <span><Trash2 size={17} aria-hidden="true" /></span>
            <b>عکس رو پاک کن</b>
          </button>
        </div>
      </ProfileSheet>
    </div>
  );
}

/**
 * One card for everything about how the profile looks: poster banner, logo/
 * avatar (overlapping the banner, Instagram-edit style), and the name/
 * specialty/contact edit entry — was three separate, visually repetitive
 * cards (each showing the same logo thumbnail on its own row).
 */
function BrandCard({
  hasPoster,
  poster,
  posterPosition,
  avatar,
  avatarPosition,
  logoSaving,
  posterSaving,
  onSaveLogo,
  onSavePoster,
  onRemoveLogo,
  onRemovePoster,
  onSaveAvatarPosition,
  onSavePosterPosition,
  pendingAvatarUpload = "",
  pendingPosterUpload = "",
  onConfirmAvatarUpload,
  onConfirmPosterUpload,
  onCancelAvatarUpload,
  onCancelPosterUpload,
  accountTitle,
  accountDescription,
  onEditProfile
}) {
  const logoInputRef = useRef(null);
  const posterInputRef = useRef(null);
  // "reposition" opens the editor manually on the already-saved image;
  // a fresh pendingAvatarUpload/pendingPosterUpload (set the instant a
  // file is picked, before any upload happens) opens it automatically on
  // the new image instead, so choosing where to crop is part of picking
  // the photo, not a separate step after it's already live everywhere.
  const [positionEditor, setPositionEditor] = useState(null);
  const avatarEditorOpen = Boolean(pendingAvatarUpload) || positionEditor === "avatar";
  const posterEditorOpen = Boolean(pendingPosterUpload) || positionEditor === "poster";

  return (
    <section className="brandCard" aria-label="برند و ظاهر پروفایل">
      {hasPoster ? (
        <div className="brandCardPoster">
          {poster ? <img src={poster} alt="" style={{ objectPosition: posterPosition || "50% 50%" }} /> : null}
          <ImageEditMenu
            hasImage={Boolean(poster)}
            busy={posterSaving}
            title={poster ? "عوض کردن پوستر" : "یه پوستر بذار"}
            triggerClassName="brandCardPosterEdit"
            triggerLabel=""
            triggerIcon={
              <span className="brandCardPosterPill">
                {poster ? <Camera size={15} aria-hidden="true" /> : <ImagePlus size={17} aria-hidden="true" />}
                {poster ? "عوض کردن پوستر" : "یه پوستر بذار"}
                {poster ? null : <Plus size={15} strokeWidth={3} aria-hidden="true" />}
              </span>
            }
            onPickFile={() => posterInputRef.current?.click()}
            onReposition={() => setPositionEditor("poster")}
            onRemove={onRemovePoster}
          />
          <input ref={posterInputRef} type="file" accept="image/*" hidden onChange={onSavePoster} />

          <div className="brandCardAvatarWrap">
            <span className="brandCardAvatar">
              <img src={avatar} alt="" style={{ objectPosition: avatarPosition || "50% 50%" }} />
            </span>
            <ImageEditMenu
              hasImage={!isDefaultAvatar(avatar)}
              busy={logoSaving}
              title="لوگو"
              triggerClassName="brandCardAvatarEdit"
              triggerLabel=""
              triggerIcon={isDefaultAvatar(avatar) ? <Plus size={16} strokeWidth={3} aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
              onPickFile={() => logoInputRef.current?.click()}
              onReposition={() => setPositionEditor("avatar")}
              onRemove={onRemoveLogo}
            />
            <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={onSaveLogo} />
          </div>
        </div>
      ) : (
        <div className="brandCardAvatarOnly">
          <span className="brandCardAvatar">
            <img src={avatar} alt="" style={{ objectPosition: avatarPosition || "50% 50%" }} />
          </span>
          <ImageEditMenu
            hasImage={!isDefaultAvatar(avatar)}
            busy={logoSaving}
            title="لوگو"
            triggerClassName="brandCardAvatarEdit"
            triggerLabel=""
            triggerIcon={isDefaultAvatar(avatar) ? <Plus size={16} strokeWidth={3} aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
            onPickFile={() => logoInputRef.current?.click()}
            onReposition={() => setPositionEditor("avatar")}
            onRemove={onRemoveLogo}
          />
          <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={onSaveLogo} />
        </div>
      )}

      <button type="button" className={`brandCardFooter ${hasPoster ? "has-overlap" : ""}`} onClick={onEditProfile}>
        <span className="brandCardFooterCopy">
          <strong>{accountTitle}</strong>
          <small>{accountDescription}</small>
        </span>
        <em className="brandCardFooterAction">
          <Pencil size={14} />
          ویرایش
        </em>
      </button>

      <ImagePositionEditor
        open={avatarEditorOpen}
        shape="circle"
        image={pendingAvatarUpload || avatar}
        busy={logoSaving}
        onSave={(value, cropped) => {
          if (pendingAvatarUpload) {
            onConfirmAvatarUpload(value, cropped);
          } else {
            onSaveAvatarPosition(value, cropped);
            setPositionEditor(null);
          }
        }}
        onClose={() => (pendingAvatarUpload ? onCancelAvatarUpload() : setPositionEditor(null))}
      />
      <ImagePositionEditor
        open={posterEditorOpen}
        shape="wide"
        image={pendingPosterUpload || poster}
        busy={posterSaving}
        onSave={(value, cropped) => {
          if (pendingPosterUpload) {
            onConfirmPosterUpload(value, cropped);
          } else {
            onSavePosterPosition(value, cropped);
            setPositionEditor(null);
          }
        }}
        onClose={() => (pendingPosterUpload ? onCancelPosterUpload() : setPositionEditor(null))}
      />
    </section>
  );
}

/**
 * Top-level "تنظیمات" tab — replaces the old Explore tab. Same settings
 * content the profile-hero gear icon used to open as a sheet
 * (ProfileSettingsSheet), presented as its own page instead of an overlay.
 */
export function SettingsPage({
  active,
  profile,
  locationSaving = false,
  onSaveLocation,
  instagramSaving = false,
  onSaveInstagram,
  onEditProfile,
  logoSaving = false,
  posterSaving = false,
  onSaveLogo,
  onSavePoster,
  onRemoveLogo,
  onRemovePoster,
  onSaveAvatarPosition,
  onSavePosterPosition,
  pendingAvatarUpload = "",
  pendingPosterUpload = "",
  onConfirmAvatarUpload,
  onConfirmPosterUpload,
  onCancelAvatarUpload,
  onCancelPosterUpload,
  profileSettings,
  onToggleSetting,
  savedPostsCount = 0,
  onOpenSaved,
  onLogout,
  onDeleteAccount,
  onNotify,
  hoursOpen = false,
  onToggleHoursOpen,
  hoursList = [],
  openDaysCount = 0,
  onSaveHours,
  hoursBookings = []
}) {
  if (!profile) {
    return <div className={`settingsPagePanel mobilePage page-settings ${active ? "is-active" : ""}`} id="settings" />;
  }

  const isArtist = profile.type === "artist";
  const isSalon = profile.type === "salon";
  const accountTitle = isArtist ? "پروفایلت" : isSalon ? "اطلاعات سالن" : "پروفایلت";
  const isClient = !isArtist && !isSalon;
  const clientPhone = String(profile?.data?.phone || "").trim();
  const accountDescription = isArtist
    ? "اسم هنری و شماره"
    : isSalon
      ? "اسم سالن و شماره"
      : clientPhone
        ? <span dir="ltr">{toPersianDigits(clientPhone)}</span>
        : "اسم و شماره";
  const accountAvatar = profile?.data?.avatar || profile?.avatar || defaultAvatarFor(profile?.type);
  const savedTitle = "ذخیره‌شده‌ها";
  const savedDescription = savedPostsCount ? `${toPersianDigits(savedPostsCount)} تا` : "هنوز چیزی نیست";

  const isPro = isArtist || isSalon;
  const pendingKeys = new Set(
    profileTodos({ type: profile.type, data: profile.data || {}, hasDefaultAvatar: isDefaultAvatar(accountAvatar), openDaysCount })
      .filter((todo) => !todo.done)
      .map((todo) => todo.key)
  );

  return (
    <div className={`settingsPagePanel mobilePage page-settings ${active ? "is-active" : ""}`} id="settings">
      <div className="settingsPageBody">
        {/* The subscription is the first thing a salon or artist sees (salons and artists only; hidden until billing is on). */}
        {isPro ? <SubscriptionCard /> : null}
        {isPro ? <SmsPackCard /> : null}

        {/* Who you are, with the poster and logo on it. */}
        <section className="spSection" aria-label={isClient ? "پروفایلم" : "پروفایل"}>
          <BrandCard
            hasPoster={isPro}
            poster={profile?.data?.poster || ""}
            posterPosition={profile?.data?.posterPosition || ""}
            avatar={accountAvatar}
            avatarPosition={profile?.data?.avatarPosition || ""}
            logoSaving={logoSaving}
            posterSaving={posterSaving}
            onSaveLogo={onSaveLogo}
            onSavePoster={onSavePoster}
            onRemoveLogo={onRemoveLogo}
            onRemovePoster={onRemovePoster}
            onSaveAvatarPosition={onSaveAvatarPosition}
            onSavePosterPosition={onSavePosterPosition}
            pendingAvatarUpload={pendingAvatarUpload}
            pendingPosterUpload={pendingPosterUpload}
            onConfirmAvatarUpload={onConfirmAvatarUpload}
            onConfirmPosterUpload={onConfirmPosterUpload}
            onCancelAvatarUpload={onCancelAvatarUpload}
            onCancelPosterUpload={onCancelPosterUpload}
            accountTitle={accountTitle}
            accountDescription={accountDescription}
            onEditProfile={onEditProfile}
          />
        </section>

        {/* «کارهای مونده»: only while something is undone. */}
        <ProfileProgress
          type={profile.type}
          data={profile.data || {}}
          hasDefaultAvatar={isDefaultAvatar(accountAvatar)}
          openDaysCount={openDaysCount}
          onEditProfile={onEditProfile}
        />

        {/* Everything else is a tile: a tap opens its own editor or sheet. */}
        <section className="spTiles" aria-label="تنظیمات">
          <TileSlot id="location" pending={pendingKeys.has("location")}>
            <ProfileLocationSettings
              profileType={profile?.type}
              value={profile?.data?.area || ""}
              location={profile?.data?.location || null}
              saving={locationSaving}
              onSave={onSaveLocation}
            />
          </TileSlot>

          {isPro ? (
            <TileSlot id="instagram" pending={pendingKeys.has("instagram")}>
              <ProfileInstagramSettings
                profileType={profile?.type}
                profileId={profile?.id}
                name={profile?.data?.name || ""}
                value={profile?.data?.instagram || ""}
                saving={instagramSaving}
                onSave={onSaveInstagram}
                onNotify={onNotify}
              />
            </TileSlot>
          ) : null}

          {isPro ? (
            <TileSlot id="link">
              <PageLinkTile profile={profile} />
            </TileSlot>
          ) : null}

          <TileSlot id="saved">
            <div className="settingsRowCard">
              <button type="button" className="profileLocationRow" onClick={onOpenSaved}>
                <span className="profileLocationRowIcon" aria-hidden="true">
                  <Bookmark size={17} />
                </span>
                <span className="profileLocationRowInfo">
                  <strong>{savedTitle}</strong>
                  <span>{savedDescription}</span>
                </span>
                <ChevronLeft size={16} className="profileLocationRowChevron" aria-hidden="true" />
              </button>
            </div>
          </TileSlot>

          {isPro ? (
            <TileSlot id="hours" pending={pendingKeys.has("hours")}>
              <SalonHoursEditor
                kicker={isArtist ? "تنظیمات آرتیست" : "تنظیمات سالن"}
                isArtist={isArtist}
                open={hoursOpen}
                onToggleOpen={onToggleHoursOpen}
                hoursList={hoursList}
                openDaysCount={openDaysCount}
                bookings={hoursBookings}
                onSave={onSaveHours}
              />
            </TileSlot>
          ) : null}

          {isSalon ? (
            <TileSlot id="rules">
              <SalonRulesSettings onNotify={onNotify} />
            </TileSlot>
          ) : null}

          {isPro ? (
            <TileSlot id="visibility">
              <VisibilityTile profileType={profile.type} profileSettings={profileSettings} onToggle={onToggleSetting} />
            </TileSlot>
          ) : null}

          {isArtist ? (
            <TileSlot id="bookings">
              <ArtistBookingTile profileSettings={profileSettings} onToggle={onToggleSetting} />
            </TileSlot>
          ) : null}

          <TileSlot id="notifications">
            <NotificationsTile profileType={profile.type} profileSettings={profileSettings} onToggle={onToggleSetting} />
          </TileSlot>

          <TileSlot id="appearance" wide>
            <AppearanceTile />
          </TileSlot>
        </section>

        {/* Account: always last, so sign-out and deletion are never in the way of the settings above. */}
        <section className="spSection" aria-label="حساب و پشتیبانی">
          <div className="neoSettingsPanel">
            <AccountSettings onLogout={onLogout} onDeleteAccount={onDeleteAccount} onNotice={onNotify} isClient={isClient} />
          </div>
        </section>
      </div>
    </div>
  );
}
