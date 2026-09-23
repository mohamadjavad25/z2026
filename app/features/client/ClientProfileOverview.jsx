"use client";

import { Bookmark, ChevronLeft, Pencil, Phone } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileSettingsPanel } from "../profile/ProfileSettingsPanel";

/**
 * Client role — content for the "پروفایل" rail tab (profileView === "overview").
 * Real profile fields only (name/avatar/phone, same source as
 * ProfileEditModal) plus shortcuts into the other client panels — no fake
 * stats. Editing itself stays in ProfileEditModal; this is a summary + entry
 * point into it.
 *
 * No location/area field here: it isn't read anywhere yet (not by order
 * creation, not by any nearby-salon search), so showing it would just be a
 * decorative field with no real effect — add it back once a real delivery-
 * address flow exists (scoped to checkout, not a static profile field, since
 * a delivery address can differ per order).
 *
 * This tab is also the client's *only* settings surface (there is no
 * separate settings sheet for clients — see ProfileHero/HomeApp): the
 * notification toggles + logout live here, reusing the same components/
 * handlers the settings sheet used to use, instead of a second edit-profile
 * or saved-posts entry point.
 *
 * No "فعالیت من" shortcut here: ProfileModeRail already renders that as a
 * tab right above this screen, so a second button to the same
 * profileView("bookings") destination was a pure duplicate.
 */
export function ClientProfileOverview({
  profile,
  onEditProfile,
  onOpenSaved,
  profileSettings,
  onToggleSetting,
  onLogout,
  onDeleteAccount
}) {
  const name = profile?.data?.name || "";
  const avatar = profile?.data?.avatar || "/profile-icon.svg";
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

      <div className="clientProfileOverviewLinks">
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
          onDeleteAccount={onDeleteAccount}
        />
      ) : null}
    </section>
  );
}
