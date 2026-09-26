"use client";

import { useRef } from "react";
import { Bookmark, Camera, ChevronLeft, ImagePlus, Pencil } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileLocationSettings } from "../profile/ProfileLocationSettings";
import { ProfileSettingsPanel } from "../profile/ProfileSettingsPanel";
import { SalonHoursEditor } from "../profile/SalonHoursEditor";

/**
 * One card for everything about how the profile looks: poster banner, logo/
 * avatar (overlapping the banner, Instagram-edit style), and the name/
 * specialty/contact edit entry — was three separate, visually repetitive
 * cards (each showing the same logo thumbnail on its own row).
 */
function BrandCard({ hasPoster, poster, avatar, logoSaving, posterSaving, onSaveLogo, onSavePoster, accountTitle, accountDescription, onEditProfile }) {
  const logoInputRef = useRef(null);
  const posterInputRef = useRef(null);

  return (
    <section className="brandCard" aria-label="برند و ظاهر پروفایل">
      {hasPoster ? (
        <div className="brandCardPoster">
          {poster ? <img src={poster} alt="" /> : <ImagePlus size={20} />}
          <button
            type="button"
            className="brandCardPosterEdit"
            onClick={() => posterInputRef.current?.click()}
            disabled={posterSaving}
          >
            <Camera size={12} />
            {posterSaving ? "در حال آپلود…" : poster ? "تغییر پوستر" : "افزودن پوستر"}
          </button>
          <input ref={posterInputRef} type="file" accept="image/*" hidden onChange={onSavePoster} />

          <div className="brandCardAvatarWrap">
            <span className="brandCardAvatar">
              <img src={avatar} alt="" />
            </span>
            <button
              type="button"
              className="brandCardAvatarEdit"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoSaving}
              aria-label="تغییر لوگو"
            >
              <Camera size={11} />
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={onSaveLogo} />
          </div>
        </div>
      ) : (
        <div className="brandCardAvatarOnly">
          <span className="brandCardAvatar">
            <img src={avatar} alt="" />
          </span>
          <button
            type="button"
            className="brandCardAvatarEdit"
            onClick={() => logoInputRef.current?.click()}
            disabled={logoSaving}
            aria-label="تغییر عکس پروفایل"
          >
            <Camera size={11} />
          </button>
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
  avatarPreview = "",
  posterPreview = "",
  onSaveLogo,
  onSavePoster,
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
  const accountAvatar = avatarPreview || profile?.data?.avatar || profile?.avatar || "/profile-icon.svg";

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
          poster={posterPreview || profile?.data?.poster || ""}
          avatar={accountAvatar}
          logoSaving={logoSaving}
          posterSaving={posterSaving}
          onSaveLogo={onSaveLogo}
          onSavePoster={onSavePoster}
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
