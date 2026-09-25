"use client";

import { useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  Check,
  Eye,
  MapPin,
  Pencil,
  Percent,
  Phone,
  ShieldCheck,
  Timer,
  UserRound,
  X
} from "lucide-react";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";

/**
 * A fact row that becomes a small inline form on click — used only for
 * fields the salon actually owns (name/phone of a salon-only staff entry).
 * Never used for data mirrored from a real artist account.
 */
function EditableFact({ icon: Icon, label, value, placeholder, dir, formatValue, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (!editing) {
    return (
      <button
        type="button"
        className="staffProfileFact is-editable"
        onClick={() => {
          setDraft(value || "");
          setEditing(true);
        }}
      >
        <span className="staffProfileFactIcon"><Icon size={14} /></span>
        <div>
          <b>{label}</b>
          <em dir={dir}>{value ? (formatValue ? formatValue(value) : value) : placeholder}</em>
        </div>
        <Pencil size={12} className="staffProfileFactEditIcon" />
      </button>
    );
  }

  return (
    <form
      className="staffProfileFact is-editing"
      onSubmit={(event) => {
        event.preventDefault();
        const next = draft.trim();
        if (next && next !== value) onSave(next);
        setEditing(false);
      }}
    >
      <span className="staffProfileFactIcon"><Icon size={14} /></span>
      <input
        autoFocus
        dir={dir}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => event.currentTarget.form?.requestSubmit()}
      />
      <button type="submit" aria-label="ذخیره" onMouseDown={(event) => event.preventDefault()}>
        <Check size={14} />
      </button>
    </form>
  );
}

/**
 * Salon owner — staff profile / manage modal.
 * Presentational: selected staff + role/state/remove/public callbacks.
 *
 * Two distinct data-ownership modes, made explicit with a badge:
 *  - linked artist account (hasPublic): contact/region belong to the
 *    artist's own profile, shown read-only — the salon can't edit
 *    someone else's account from here.
 *  - salon-only placeholder (!hasPublic): the salon fully owns this
 *    record, so name/phone are editable in place.
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
            <span className={`staffProfileOwnerBadge ${hasPublic ? "is-linked" : "is-local"}`}>
              {hasPublic ? <ShieldCheck size={12} /> : <UserRound size={12} />}
              {hasPublic ? "حساب آرتیست متصل" : "فقط ثبت در سالن"}
            </span>
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
            <small>{hasPublic ? "از حساب آرتیست · فقط نمایش" : "ثبت‌شده در سالن · قابل ویرایش"}</small>
          </div>
          <div className="staffProfileFacts">
            {hasPublic ? (
              <>
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
              </>
            ) : (
              <>
                <EditableFact
                  icon={UserRound}
                  label="نام"
                  value={staffName}
                  placeholder="نام پرسنل"
                  onSave={(name) => onUpdate?.(staff, { name }, "نام بروزرسانی شد.")}
                />
                <EditableFact
                  icon={Phone}
                  label="تماس"
                  value={staffPhone}
                  placeholder="شماره تماس"
                  dir="ltr"
                  formatValue={toPersianDigits}
                  onSave={(phone) => onUpdate?.(staff, { phone }, "شماره تماس بروزرسانی شد.")}
                />
              </>
            )}
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
