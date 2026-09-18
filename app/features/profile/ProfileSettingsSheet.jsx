"use client";

import { Bookmark, ChevronLeft, Pencil, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileLocationSettings } from "./ProfileLocationSettings";
import { ProfileSettingsPanel } from "./ProfileSettingsPanel";
import { SalonHoursEditor } from "./SalonHoursEditor";

/**
 * Shared profile settings sheet (all roles) with optional salon hours editor.
 * Presentational: open/settings/hours state owned by HomeApp.
 */
export function ProfileSettingsSheet({
  open,
  profile,
  kicker = "پروفایل",
  locationSaving = false,
  onSaveLocation,
  onEditProfile,
  onClose,
  profileSettings,
  onToggleSetting,
  artistBookingSettings = null,
  onArtistBookingChange = null,
  savedPostsCount = 0,
  savedSalonsCount = 0,
  onOpenSaved,
  onLogout,
  // salon hours (only used when profile.type === "salon")
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
  if (!open || !profile) return null;
  const isShop = profile.type === "shop";
  const isArtist = profile.type === "artist";
  const isSalon = profile.type === "salon";
  const isClient = profile.type === "client";
  const sheetKicker = isShop ? "پنل فروش فروشگاه" : isSalon ? "" : kicker;
  const sheetTitle = isShop ? "تنظیمات فروشگاه" : isArtist ? "کنترل‌پنل آرتیست" : isClient ? "تنظیمات بانو" : "تنظیمات";
  const accountTitle = isShop ? "ویرایش اطلاعات فروشگاه" : isArtist ? "برند شخصی آرتیست" : isSalon ? "ویرایش برند سالن" : isClient ? "ویرایش پروفایل بانو" : "ویرایش پروفایل";
  const accountDescription = isShop
    ? "لوگو، نام فروشگاه، دسته‌بندی، معرفی و تماس"
    : isArtist
      ? "عکس، نام هنری، تخصص، تماس و مسیر رزرو"
      : isSalon
        ? "لوگو، نام سالن، شماره تماس و مسیر رزرو"
        : isClient
          ? "عکس، نام، شهر و تماس"
    : "عکس، نام، تماس، ایمیل و رمز عبور";
  const accountAvatar = isShop
    ? (profile?.data?.avatar || profile?.avatar || "/cosmetics-bold-poster.png")
    : (profile?.data?.avatar || profile?.avatar || "/profile-icon.svg");

  return (
    <div
      className="salonHeroSheetBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="تنظیمات"
      onClick={onClose}
    >
      <aside className={`salonHeroSheetPanel ${isShop ? "is-shop-settings" : ""} ${isArtist ? "is-artist-settings is-salon-settings" : ""} ${(isSalon || isClient) ? "is-salon-settings" : ""}`} onClick={(event) => event.stopPropagation()}>
        <div className="salonHeroSheetHead">
          <div>
            {!isShop ? <span>{sheetKicker}</span> : null}
            <h3>{sheetTitle}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن تنظیمات">
            <X size={18} />
          </button>
        </div>
        <div className="settingsPanel">
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
          {(isArtist || isClient) ? (
            <section className="salonSettingsBookmarkCard" aria-label={isClient ? "مدل‌های ذخیره‌شده بانو" : "بوکمارک‌های آرتیست"}>
              <span className="salonSettingsBookmarkIcon">
                <Bookmark size={18} />
              </span>
              <span className="salonSettingsBookmarkCopy">
                <strong>{isClient ? "مدل‌های ذخیره‌شده" : "بوکمارک‌های آرتیست"}</strong>
                <small>{toPersianDigits(savedPostsCount || 0)} نمونه ذخیره‌شده</small>
              </span>
              <button type="button" onClick={onOpenSaved}>
                مشاهده
                <ChevronLeft size={16} />
              </button>
            </section>
          ) : null}
          {isSalon ? (
            <>
              <section className="salonSettingsBookmarkCard" aria-label="بوکمارک‌های سالن">
                <span className="salonSettingsBookmarkIcon">
                  <Bookmark size={18} />
                </span>
                <span className="salonSettingsBookmarkCopy">
                  <strong>بوکمارک‌های سالن</strong>
                </span>
                <button type="button" onClick={onOpenSaved}>
                  مشاهده
                  <ChevronLeft size={16} />
                </button>
              </section>
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
            </>
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
            artistBookingSettings={profile.type === "artist" ? artistBookingSettings : null}
            onArtistBookingChange={profile.type === "artist" ? onArtistBookingChange : null}
            onLogout={onLogout}
          />
        </div>
      </aside>
    </div>
  );
}
