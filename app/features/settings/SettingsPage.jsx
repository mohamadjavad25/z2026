"use client";

import { useRef } from "react";
import { Bookmark, Camera, ChevronLeft, ImagePlus, Pencil } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileLocationSettings } from "../profile/ProfileLocationSettings";
import { ProfileSettingsPanel } from "../profile/ProfileSettingsPanel";
import { SalonHoursEditor } from "../profile/SalonHoursEditor";

/** One tap-to-replace image row (logo/poster) — hidden file input behind a visible button. */
function ImagePickerRow({ variant, label, hint, image, saving, onPick }) {
  const inputRef = useRef(null);
  return (
    <div className={`settingsImagePicker is-${variant}`}>
      <div className="settingsImagePickerPreview">
        {image ? <img src={image} alt="" /> : <ImagePlus size={variant === "logo" ? 18 : 22} />}
      </div>
      <div className="settingsImagePickerCopy">
        <strong>{label}</strong>
        <small>{hint}</small>
      </div>
      <button
        type="button"
        className="settingsImagePickerBtn"
        onClick={() => inputRef.current?.click()}
        disabled={saving}
      >
        <Camera size={14} />
        {saving ? "در حال آپلود…" : image ? "تغییر" : "افزودن"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onPick}
      />
    </div>
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
  onUpdateHour
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
      <div className="settingsPageHead">
        <span>تنظیمات</span>
        <strong>{isArtist ? "کنترل‌پنل آرتیست" : isSalon ? "مدیریت سالن" : "حساب کاربری"}</strong>
      </div>

      <div className="settingsPageBody">
        <ProfileLocationSettings
          profileType={profile?.type}
          value={profile?.data?.area || ""}
          saving={locationSaving}
          onSave={onSaveLocation}
        />

        <button type="button" className="settingsAccountCard" onClick={onEditProfile}>
          <span className="settingsAccountAvatar">
            <img src={accountAvatar} alt="" />
          </span>
          <span className="settingsAccountCopy">
            <strong>{accountTitle}</strong>
            {!isSalon ? <small>{accountDescription}</small> : null}
          </span>
          <em className="settingsAccountAction">
            <Pencil size={15} />
            ویرایش
          </em>
        </button>

        <section className="settingsImagesSection" aria-label="لوگو و پوستر">
          <ImagePickerRow
            variant="logo"
            label={isSalon ? "لوگوی سالن" : isArtist ? "لوگو / آواتار" : "عکس پروفایل"}
            hint="روی پروفایل، کارت‌ها و نتایج جستجو نشان داده می‌شود"
            image={accountAvatar !== "/profile-icon.svg" ? accountAvatar : ""}
            saving={logoSaving}
            onPick={(event) => onSaveLogo?.(event)}
          />
          {isArtist || isSalon ? (
            <ImagePickerRow
              variant="poster"
              label="پوستر پروفایل"
              hint="تصویر پس‌زمینه بالای پروفایل عمومی"
              image={profile?.data?.poster || ""}
              saving={posterSaving}
              onPick={(event) => onSavePoster?.(event)}
            />
          ) : null}
        </section>

        {isArtist || isSalon ? (
          <section className="salonSettingsBookmarkCard" aria-label="بوکمارک‌ها">
            <span className="salonSettingsBookmarkIcon">
              <Bookmark size={18} />
            </span>
            <span className="salonSettingsBookmarkCopy">
              <strong>{isArtist ? "بوکمارک‌های آرتیست" : "بوکمارک‌های سالن"}</strong>
              {isArtist ? <small>{toPersianDigits(savedPostsCount || 0)} نمونه ذخیره‌شده</small> : null}
            </span>
            <button type="button" onClick={onOpenSaved}>
              مشاهده
              <ChevronLeft size={16} />
            </button>
          </section>
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
