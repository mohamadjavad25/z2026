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
import { StaffPerformanceChart } from "./StaffPerformanceChart";
import { ServiceIcon } from "../../components/ServiceIcon";

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
        className="smdRow is-editable"
        onClick={() => {
          setDraft(value || "");
          setEditing(true);
        }}
      >
        <Icon size={15} />
        <span>{label}</span>
        <b dir={dir}>{value ? (formatValue ? formatValue(value) : value) : placeholder}</b>
        <Pencil size={12} className="smdEdit" />
      </button>
    );
  }

  return (
    <form
      className="smdRow is-editing"
      onSubmit={(event) => {
        event.preventDefault();
        const next = draft.trim();
        if (next && next !== value) onSave(next);
        setEditing(false);
      }}
    >
      <Icon size={15} />
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
  stats = null,
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
  const plainBio = isCollabBio || /^پیوستن با اسکن کد QR/.test(staffBio) ? "" : staffBio;

  return (
    <div
      className="artistProfileModal staffProfileModal"
      role="dialog"
      aria-modal="true"
      aria-label={`مدیریت ${staffName}`}
      onClick={onClose}
    >
      <article className="artistProfileSheet is-staffProfile smdSheet" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="artistProfileClose" onClick={onClose} aria-label="بستن">
          <X size={17} />
        </button>

        <header className="smdHero">
          <div className="smdAvatar">
            <img src={staffAvatar || "/profile-icon.svg"} alt="" />
            <i className={`smdDot ${isActive ? "is-active" : "is-idle"}`} aria-hidden="true" />
          </div>
          <b className="smdName">{staffName}</b>
          <span className="smdRole">
            <ServiceIcon name={staffRole} size="xs" />
            {staffRole}
          </span>
          <div className="smdMeta">
            <span className={`smdState ${isActive ? "is-active" : "is-idle"}`}>{staffState}</span>
            {hasPublic ? <span className="smdLinked"><ShieldCheck size={12} />عضو زیبابان</span> : null}
            {staffArea ? <span><MapPin size={12} />{staffArea}</span> : null}
          </div>
        </header>

        <div className="smdActions">
          {staffPhone ? (
            <a className="smdBtn" href={`tel:${toLatinDigits(staffPhone)}`}>
              <Phone size={15} />
              تماس
            </a>
          ) : (
            <button type="button" className="smdBtn" disabled>
              <Phone size={15} />
              بدون شماره
            </button>
          )}
          {hasPublic ? (
            <button type="button" className="smdBtn is-primary" onClick={() => onOpenPublic?.(staff)}>
              <Eye size={15} />
              پروفایل عمومی
            </button>
          ) : (
            <button type="button" className="smdBtn" disabled>
              <Eye size={15} />
              بدون پروفایل
            </button>
          )}
        </div>

        <StaffPerformanceChart stats={stats} />

        <section className="smdSection">
          <h4>اطلاعات تماس و دسترسی</h4>
          <div className="smdList">
            {hasPublic ? (
              <>
                <div className="smdRow">
                  <Phone size={15} />
                  <span>تماس</span>
                  <b dir="ltr">{staffPhone ? toPersianDigits(staffPhone) : "ثبت نشده"}</b>
                </div>
                <div className="smdRow">
                  <MapPin size={15} />
                  <span>منطقه</span>
                  <b>{staffArea || "ثبت نشده"}</b>
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
            <div className="smdRow">
              <ShieldCheck size={15} />
              <span>سطح دسترسی</span>
              <b>{staffAccess}</b>
            </div>
            {staffBooked ? (
              <div className="smdRow">
                <CalendarCheck size={15} />
                <span>رزروها</span>
                <b>{toPersianDigits(staffBooked)}</b>
              </div>
            ) : null}
          </div>
        </section>

        {(collabDays || collabHours || collabShare) ? (
          <section className="smdSection">
            <h4>شرایط همکاری</h4>
            <div className="smdTerms">
              {collabDays ? <span><CalendarDays size={14} />{collabDays}</span> : null}
              {collabHours ? <span><Timer size={14} />{toPersianDigits(collabHours)}</span> : null}
              {collabShare ? <span><Percent size={14} />سهم آرتیست {toPersianDigits(collabShare)}</span> : null}
            </div>
          </section>
        ) : plainBio ? (
          <section className="smdSection">
            <h4>توضیحات</h4>
            <p className="smdBio">{plainBio}</p>
          </section>
        ) : null}

        <section className="smdSection">
          <h4>حوزه فعالیت <small>برای رزرو و منوی سالن</small></h4>
          <div className="smdRoles" role="group" aria-label="حوزه فعالیت">
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
                <ServiceIcon name={role} size="xs" />
                {role}
              </button>
            ))}
          </div>
        </section>

        <footer className="smdFooter">
          <button
            type="button"
            className="smdToggle"
            onClick={() => {
              const nextState = isActive ? "غیرفعال" : "فعال";
              onUpdate?.(staff, { state: nextState }, `وضعیت همکاری ${staffName} تغییر کرد.`);
            }}
          >
            {isActive ? "غیرفعال کردن" : "فعال کردن مجدد"}
          </button>
          <button type="button" className="smdEnd" onClick={() => onRemove?.(staff)}>
            پایان همکاری
          </button>
        </footer>
      </article>
    </div>
  );
}
