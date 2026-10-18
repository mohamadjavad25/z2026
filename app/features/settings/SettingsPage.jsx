"use client";

import { defaultAvatarFor, isDefaultAvatar } from "../../shared/lib/defaultAvatar";
import { useRef, useState } from "react";
import { Bookmark, Camera, ChevronLeft, ImagePlus, Move, Pencil, Plus, Trash2 } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ProfileLocationSettings } from "../profile/ProfileLocationSettings";
import {
  AccountSettings,
  AppearanceSettings,
  ArtistBookingSettings,
  NotificationSettings,
  ProfileVisibilitySettings
} from "../profile/ProfileSettingsPanel";
import { SalonHoursEditor } from "../profile/SalonHoursEditor";
import { ImagePositionEditor } from "./ImagePositionEditor";
import { SalonRulesSettings } from "../salons/SalonRulesSettings";
import { SubscriptionCard } from "../billing";

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
        {busy ? "در حال ذخیره…" : triggerLabel}
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
            <b>انتخاب عکس جدید</b>
            <small>از گالری یا دوربین</small>
          </button>
          <button type="button" role="menuitem" onClick={() => run(onReposition)}>
            <span><Move size={17} aria-hidden="true" /></span>
            <b>تنظیم کادر تصویر</b>
            <small>جابه‌جایی و بزرگ‌نمایی</small>
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => run(onRemove)}>
            <span><Trash2 size={17} aria-hidden="true" /></span>
            <b>حذف عکس</b>
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
            title={poster ? "تغییر پوستر" : "افزودن پوستر"}
            triggerClassName="brandCardPosterEdit"
            triggerLabel=""
            triggerIcon={
              <span className="brandCardPosterPill">
                {poster ? <Camera size={15} aria-hidden="true" /> : <ImagePlus size={17} aria-hidden="true" />}
                {poster ? "تغییر پوستر" : "افزودن پوستر"}
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
  hoursPresets = [],
  activeHoursPresetId,
  activeHoursPresetMeta,
  hoursList = [],
  selectedHour,
  hourTimeOptions = [],
  openDaysCount = 0,
  weeklyCapacityTotal = 0,
  onSelectHoursPreset,
  onSelectHourDay,
  onUpdateHour,
  onCopyHourToOpenDays
}) {
  if (!profile) {
    return <div className={`settingsPagePanel mobilePage page-settings ${active ? "is-active" : ""}`} id="settings" />;
  }

  const isArtist = profile.type === "artist";
  const isSalon = profile.type === "salon";
  const accountTitle = isArtist ? "برند شخصی آرتیست" : isSalon ? "ویرایش برند سالن" : "ویرایش پروفایل";
  const isClient = !isArtist && !isSalon;
  const clientPhone = String(profile?.data?.phone || "").trim();
  const accountDescription = isArtist
    ? "عکس، نام هنری، تخصص، تماس و مسیر رزرو"
    : isSalon
      ? "لوگو، نام سالن، شماره تماس و مسیر رزرو"
      : clientPhone
        ? <><span dir="ltr">{toPersianDigits(clientPhone)}</span>{" · عکس، نام، ایمیل و رمز عبور"}</>
        : "عکس، نام، تماس، ایمیل و رمز عبور";
  const accountAvatar = profile?.data?.avatar || profile?.avatar || defaultAvatarFor(profile?.type);
  const roleLabel = isArtist ? "حساب آرتیست" : isSalon ? "حساب سالن" : "حساب من";
  const savedTitle = isArtist ? "بوکمارک‌های آرتیست" : isSalon ? "بوکمارک‌های سالن" : "ذخیره‌شده‌ها";
  const savedDescription = isArtist
    ? `${toPersianDigits(savedPostsCount || 0)} نمونه ذخیره‌شده`
    : isSalon
      ? "مشاهده لیست ذخیره‌شده‌ها"
      : savedPostsCount
        ? `${toPersianDigits(savedPostsCount)} مورد ذخیره‌شده`
        : "مدل‌ها و نمونه‌کارهای ذخیره‌شده";

  return (
    <div className={`settingsPagePanel mobilePage page-settings ${active ? "is-active" : ""}`} id="settings">
      <div className="settingsPageBody">
        <header className="spHeader">
          <h2 className="spHeaderTitle">تنظیمات</h2>
          <span className="spHeaderRole">{roleLabel}</span>
        </header>

        {/* 0. Subscription (salons and artists): where the account stands and the one button. Hidden until billing is on. */}
        {isArtist || isSalon ? <SubscriptionCard /> : null}

        {/* 1. Identity: who you are, where you work, and what customers see of it. */}
        <section className="spSection" aria-labelledby="spSection-profile">
          <h3 className="spSectionTitle" id="spSection-profile">{isClient ? "پروفایل من" : "پروفایل و برند"}</h3>
          <BrandCard
            hasPoster={isArtist || isSalon}
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

          <ProfileLocationSettings
            profileType={profile?.type}
            value={profile?.data?.area || ""}
            location={profile?.data?.location || null}
            saving={locationSaving}
            onSave={onSaveLocation}
          />

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

          {isArtist || isSalon ? (
            <div className="neoSettingsPanel">
              <ProfileVisibilitySettings profileType={profile.type} profileSettings={profileSettings} onToggle={onToggleSetting} />
            </div>
          ) : null}
        </section>

        {/* 2. Work and bookings: hours first, then the rules or booking switches that go with them. */}
        {isArtist || isSalon ? (
          <section className="spSection" aria-labelledby="spSection-work">
            <h3 className="spSectionTitle" id="spSection-work">کار و رزرو</h3>
            <SalonHoursEditor
              kicker={isArtist ? "تنظیمات آرتیست" : "تنظیمات سالن"}
              open={hoursOpen}
              onToggleOpen={onToggleHoursOpen}
              presets={hoursPresets}
              activePresetId={activeHoursPresetId}
              activePresetMeta={activeHoursPresetMeta}
              hoursList={hoursList}
              selectedHour={selectedHour}
              timeOptions={hourTimeOptions}
              openDaysCount={openDaysCount}
              weeklyCapacityTotal={weeklyCapacityTotal}
              onSelectPreset={onSelectHoursPreset}
              onSelectDay={onSelectHourDay}
              onUpdateHour={onUpdateHour}
              onCopyToOpenDays={onCopyHourToOpenDays}
            />
            {isArtist ? (
              <div className="neoSettingsPanel">
                <ArtistBookingSettings profileSettings={profileSettings} onToggle={onToggleSetting} />
              </div>
            ) : null}
            {isSalon ? <SalonRulesSettings onNotify={onNotify} /> : null}
          </section>
        ) : null}

        {/* 3. Notifications and appearance: how the app talks to you on this device. */}
        <section className="spSection" aria-labelledby="spSection-prefs">
          <h3 className="spSectionTitle" id="spSection-prefs">اعلان‌ها و ظاهر</h3>
          <div className="neoSettingsPanel">
            <NotificationSettings profileType={profile.type} profileSettings={profileSettings} onToggle={onToggleSetting} />
            <AppearanceSettings />
          </div>
        </section>

        {/* 4. Account: always last, so sign-out and deletion are never in the way of the settings above. */}
        <section className="spSection" aria-labelledby="spSection-account">
          <h3 className="spSectionTitle" id="spSection-account">حساب و پشتیبانی</h3>
          <div className="neoSettingsPanel">
            <AccountSettings onLogout={onLogout} onDeleteAccount={onDeleteAccount} />
          </div>
        </section>
      </div>
    </div>
  );
}
