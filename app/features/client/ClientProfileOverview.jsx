"use client";

import { Bookmark, CalendarCheck, ChevronLeft, Pencil, Phone } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileLocationSettings } from "../profile/ProfileLocationSettings";
import { ProfileSettingsPanel } from "../profile/ProfileSettingsPanel";

/**
 * Client role — content for the "پروفایل" rail tab (profileView === "overview").
 * Real profile fields only (name/avatar/area/phone, same source as
 * ProfileEditModal) plus shortcuts into the other client panels — no fake
 * stats. Editing itself stays in ProfileEditModal; this is a summary + entry
 * point into it.
 *
 * This tab is also the client's *only* settings surface (there is no
 * separate settings sheet for clients — see ProfileHero/HomeApp): the city
 * editor and the two notification toggles + logout live here, reusing the
 * same components/handlers the settings sheet used to use, instead of a
 * second edit-profile or saved-posts entry point.
 */
export function ClientProfileOverview({
  profile,
  onEditProfile,
  onOpenBookings,
  onOpenSaved,
  locationSaving = false,
  onSaveLocation,
  profileSettings,
  onToggleSetting,
  onLogout
}) {
  const name = profile?.data?.name || "";
  const avatar = profile?.data?.avatar || "/profile-icon.svg";
  const area = profile?.data?.area || "";
  const phone = profile?.data?.phone || "";

  return (
    <section className="clientProfileOverview" aria-label="پروفایل من">
      <article className="clientProfileOverviewCard">
        <span className="clientProfileOverviewAvatar">
          <img src={avatar} alt="" />
        </span>
        <div className="clientProfileOverviewCopy">
          <strong>{name || "بدون نام"}</strong>
          {phone ? (
            <span dir="ltr">
              <Phone size={13} />
              {toPersianDigits(phone)}
            </span>
          ) : null}
        </div>
        <button type="button" className="clientProfileOverviewEdit" onClick={onEditProfile}>
          <Pencil size={14} />
          ویرایش
        </button>
      </article>

      <ProfileLocationSettings
        profileType="client"
        value={area}
        saving={locationSaving}
        onSave={onSaveLocation}
      />

      <div className="clientProfileOverviewLinks">
        <button type="button" onClick={onOpenBookings}>
          <span className="clientProfileOverviewLinkIcon">
            <CalendarCheck size={17} />
          </span>
          <span className="clientProfileOverviewLinkCopy">
            <strong>فعالیت من</strong>
            <small>رزروها و خریدهای ثبت‌شده</small>
          </span>
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={onOpenSaved}>
          <span className="clientProfileOverviewLinkIcon">
            <Bookmark size={17} />
          </span>
          <span className="clientProfileOverviewLinkCopy">
            <strong>ذخیره‌شده‌ها</strong>
            <small>مدل‌ها و سالن‌های ذخیره‌شده</small>
          </span>
          <ChevronLeft size={16} />
        </button>
      </div>

      {profileSettings ? (
        <ProfileSettingsPanel
          profileType="client"
          profileSettings={profileSettings}
          onToggle={onToggleSetting}
          onLogout={onLogout}
        />
      ) : null}
    </section>
  );
}
