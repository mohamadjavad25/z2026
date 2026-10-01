"use client";

import { useRef, useState } from "react";
import { Bookmark, Camera, ChevronLeft, ImagePlus, Move, Pencil, Trash2 } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ProfileLocationSettings } from "../profile/ProfileLocationSettings";
import { ProfileSettingsPanel } from "../profile/ProfileSettingsPanel";
import { SalonHoursEditor } from "../profile/SalonHoursEditor";
import { ImagePositionEditor } from "./ImagePositionEditor";

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
      <button type="button" className={triggerClassName} onClick={onPickFile} disabled={busy}>
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
          {poster ? <img src={poster} alt="" style={{ objectPosition: posterPosition || "50% 50%" }} /> : <ImagePlus size={20} />}
          <ImageEditMenu
            hasImage={Boolean(poster)}
            busy={posterSaving}
            title="پوستر"
            triggerClassName="brandCardPosterEdit"
            triggerLabel={poster ? "تغییر پوستر" : "افزودن پوستر"}
            triggerIcon={<Camera size={12} aria-hidden="true" />}
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
              hasImage={Boolean(avatar) && !avatar.includes("/profile-icon.svg")}
              busy={logoSaving}
              title="لوگو"
              triggerClassName="brandCardAvatarEdit"
              triggerLabel=""
              triggerIcon={<Camera size={11} aria-hidden="true" />}
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
            hasImage={Boolean(avatar) && !avatar.includes("/profile-icon.svg")}
            busy={logoSaving}
            title="لوگو"
            triggerClassName="brandCardAvatarEdit"
            triggerLabel=""
            triggerIcon={<Camera size={11} aria-hidden="true" />}
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
  artistBookingSettings = null,
  onArtistBookingChange = null,
  savedPostsCount = 0,
  onOpenSaved,
  onLogout,
  onDeleteAccount,
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
  const accountDescription = isArtist
    ? "عکس، نام هنری، تخصص، تماس و مسیر رزرو"
    : isSalon
      ? "لوگو، نام سالن، شماره تماس و مسیر رزرو"
      : "عکس، نام، تماس، ایمیل و رمز عبور";
  const accountAvatar = profile?.data?.avatar || profile?.avatar || "/profile-icon.svg";

  return (
    <div className={`settingsPagePanel mobilePage page-settings ${active ? "is-active" : ""}`} id="settings">
      <div className="settingsPageBody">
        <ProfileLocationSettings
          profileType={profile?.type}
          value={profile?.data?.area || ""}
          saving={locationSaving}
          onSave={onSaveLocation}
        />

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

        {isArtist || isSalon ? (
          <div className="settingsRowCard">
            <button type="button" className="profileLocationRow" onClick={onOpenSaved}>
              <span className="profileLocationRowIcon" aria-hidden="true">
                <Bookmark size={17} />
              </span>
              <span className="profileLocationRowInfo">
                <strong>{isArtist ? "بوکمارک‌های آرتیست" : "بوکمارک‌های سالن"}</strong>
                <span>{isArtist ? `${toPersianDigits(savedPostsCount || 0)} نمونه ذخیره‌شده` : "مشاهده لیست ذخیره‌شده‌ها"}</span>
              </span>
              <ChevronLeft size={16} className="profileLocationRowChevron" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {isSalon ? (
          <SalonHoursEditor
            kicker="تنظیمات سالن"
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
        ) : null}

        {isArtist ? (
          <SalonHoursEditor
            kicker="تنظیمات آرتیست"
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
        ) : null}

        <ProfileSettingsPanel
          profileType={profile.type}
          profileSettings={profileSettings}
          onToggle={onToggleSetting}
          artistBookingSettings={isArtist ? artistBookingSettings : null}
          onArtistBookingChange={isArtist ? onArtistBookingChange : null}
          onLogout={onLogout}
          onDeleteAccount={onDeleteAccount}
        />
      </div>
    </div>
  );
}
