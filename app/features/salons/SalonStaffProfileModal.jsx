"use client";

import {
  CalendarCheck,
  CalendarDays,
  Eye,
  MapPin,
  Percent,
  Phone,
  ShieldCheck,
  Timer,
  X
} from "lucide-react";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";

/**
 * Salon owner — staff profile / manage modal.
 * Presentational: selected staff + role/state/remove/public callbacks.
 */
export function SalonStaffProfileModal({
  staff,
  roleOptions = [],
  onClose,
  onUpdate,
  onRemove,
  onOpenPublic
}) {
  if (!staff) return null;

  const staffName = staff.artist_name || staff.name || "";
  const staffRole = staff.role || staff.artist_service || roleOptions[0];
  const staffState = staff.state || "فعال";
  const staffPhone = staff.artist_phone || staff.phone || "";
  const staffArea = staff.artist_area || "";
  const staffBio = String(staff.artist_bio || staff.bio || "").trim();
  const staffAvatar = staff.avatar || staff.staff_avatar || "";
  const staffAccess = staff.access_level || "آرتیست";
  const staffBooked = staff.booked || "";
  const isActive = staffState === "فعال";
  const hasPublic = Boolean(staff.has_artist_profile || staff.artist_user_id);
  const collabDays = staffBio.match(/روزها:\s*([^·]+)/)?.[1]?.trim() || "";
  const collabHours = staffBio.match(/ساعت:\s*([^·]+)/)?.[1]?.trim() || "";
  const collabShare = staffBio.match(/سهم آرتیست:\s*([^·]+)/)?.[1]?.trim() || "";
  const isCollabBio = /پیشنهاد همکاری|سهم آرتیست|روزها:/.test(staffBio);
  const plainBio = isCollabBio ? "" : staffBio;

  return (
    <div
      className="artistProfileModal staffProfileModal"
      role="dialog"
      aria-modal="true"
      aria-label={`مدیریت ${staffName}`}
      onClick={onClose}
    >
      <article className="artistProfileSheet is-staffProfile" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="artistProfileClose" onClick={onClose} aria-label="بستن">
          <X size={17} />
        </button>

        <header className="staffProfileHero">
          <div className={`staffProfileAvatar ${staffAvatar ? "hasImage" : ""}`}>
            {staffAvatar ? <img src={staffAvatar} alt="" /> : String(staffName || "آ").slice(0, 1)}
          </div>
          <div className="staffProfileHeroCopy">
            <span>{hasPublic ? "پروفایل واقعی آرتیست" : "پروفایل پرسنل سالن"}</span>
            <b>{staffName}</b>
            <small>{staffRole}{staffArea ? ` · ${staffArea}` : ""}</small>
          </div>
          <em className={`staffProfileState ${isActive ? "is-active" : "is-idle"}`}>
            <i />
            {staffState}
          </em>
        </header>

        <div className="staffProfileQuickActions">
          {staffPhone ? (
            <a className="staffProfileQuickBtn" href={`tel:${toLatinDigits(staffPhone)}`}>
              <Phone size={15} />
              تماس
            </a>
          ) : (
            <button type="button" className="staffProfileQuickBtn" disabled>
              <Phone size={15} />
              بدون شماره
            </button>
          )}
          {hasPublic ? (
            <button
              type="button"
              className="staffProfileQuickBtn is-primary"
              onClick={() => onOpenPublic?.(staff)}
            >
              <Eye size={15} />
              پروفایل عمومی
            </button>
          ) : (
            <button type="button" className="staffProfileQuickBtn" disabled>
              <Eye size={15} />
              بدون پروفایل عمومی
            </button>
          )}
        </div>

        <section className="staffProfileSection">
          <div className="staffProfileSectionHead">
            <span>اطلاعات همکاری</span>
          </div>
          <div className="staffProfileFacts">
            <div className="staffProfileFact">
              <span className="staffProfileFactIcon"><Phone size={14} /></span>
              <div>
                <b>تماس</b>
                <em dir="ltr">{staffPhone ? toPersianDigits(staffPhone) : "ثبت نشده"}</em>
              </div>
            </div>
            <div className="staffProfileFact">
              <span className="staffProfileFactIcon"><MapPin size={14} /></span>
              <div>
                <b>منطقه</b>
                <em>{staffArea || "ثبت نشده"}</em>
              </div>
            </div>
            <div className="staffProfileFact">
              <span className="staffProfileFactIcon"><ShieldCheck size={14} /></span>
              <div>
                <b>سطح دسترسی</b>
                <em>{staffAccess}</em>
              </div>
            </div>
            {staffBooked ? (
              <div className="staffProfileFact">
                <span className="staffProfileFactIcon"><CalendarCheck size={14} /></span>
                <div>
                  <b>رزروها</b>
                  <em>{toPersianDigits(staffBooked)}</em>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {(collabDays || collabHours || collabShare) ? (
          <section className="staffProfileSection">
            <div className="staffProfileSectionHead">
              <span>شرایط همکاری</span>
              <small>از پیشنهاد همکاری</small>
            </div>
            <div className="staffProfileCollab">
              {collabDays ? (
                <article>
                  <CalendarDays size={15} />
                  <div>
                    <b>روزها</b>
                    <span>{collabDays}</span>
                  </div>
                </article>
              ) : null}
              {collabHours ? (
                <article>
                  <Timer size={15} />
                  <div>
                    <b>ساعت</b>
                    <span>{toPersianDigits(collabHours)}</span>
                  </div>
                </article>
              ) : null}
              {collabShare ? (
                <article>
                  <Percent size={15} />
                  <div>
                    <b>سهم آرتیست</b>
                    <span>{toPersianDigits(collabShare)}</span>
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        ) : plainBio ? (
          <section className="staffProfileSection">
            <div className="staffProfileSectionHead">
              <span>توضیحات</span>
            </div>
            <p className="staffProfileBio">{plainBio}</p>
          </section>
        ) : null}

        <section className="staffProfileSection">
          <div className="staffProfileSectionHead">
            <span>حوزه فعالیت</span>
            <small>برای رزرو و منوی سالن</small>
          </div>
          <div className="staffProfileRoles" role="group" aria-label="حوزه فعالیت">
            {roleOptions.map((role) => (
              <button
                type="button"
                key={role}
                className={staffRole === role ? "active" : ""}
                aria-pressed={staffRole === role}
                onClick={() => {
                  if (staffRole === role) return;
                  onUpdate?.(staff, { role }, `حوزه ${staffName} تغییر کرد.`);
                }}
              >
                {role}
              </button>
            ))}
          </div>
        </section>

        <footer className="staffProfileFooter">
          <button
            type="button"
            className={`staffProfileToggle ${isActive ? "" : "is-activate"}`}
            onClick={() => {
              const nextState = isActive ? "غیرفعال" : "فعال";
              onUpdate?.(staff, { state: nextState }, `وضعیت همکاری ${staffName} تغییر کرد.`);
            }}
          >
            {isActive ? "غیرفعال کردن" : "فعال کردن مجدد"}
          </button>
          <button
            type="button"
            className="staffProfileEnd"
            onClick={() => onRemove?.(staff)}
          >
            پایان همکاری
          </button>
        </footer>
      </article>
    </div>
  );
}
