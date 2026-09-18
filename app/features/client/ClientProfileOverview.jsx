"use client";

import { Bookmark, CalendarCheck, ChevronLeft, MapPin, Pencil, Phone } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";

/**
 * Client role — content for the "پروفایل" rail tab (profileView === "overview").
 * Real profile fields only (name/avatar/area/phone, same source as
 * ProfileEditModal) plus shortcuts into the other client panels — no fake
 * stats. Editing itself stays in ProfileEditModal; this is a summary + entry
 * point into it.
 */
export function ClientProfileOverview({ profile, onEditProfile, onOpenBookings, onOpenSaved }) {
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
          <span>
            <MapPin size={13} />
            {area || "شهر ثبت نشده"}
          </span>
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
    </section>
  );
}
