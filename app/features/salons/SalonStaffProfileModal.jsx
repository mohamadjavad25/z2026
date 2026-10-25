"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  Check,
  Eye,
  Lock,
  MapPin,
  Pencil,
  Percent,
  Phone,
  ShieldCheck,
  Timer,
  UserRound
} from "lucide-react";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { StaffPerformanceChart } from "./StaffPerformanceChart";
import { ServiceIcon } from "../../components/ServiceIcon";
import { SheetClose } from "../../components/SheetClose";

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
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [endReason, setEndReason] = useState("");
  const staffKey = staff?.id || staff?.name || "";
  useEffect(() => {
    setConfirmEnd(false);
    setEndReason("");
  }, [staffKey]);
  if (!staff) return null;

  const staffName = staff.artist_name || staff.name || "";
  const staffRole = staff.role || staff.artist_service || roleOptions[0];
  const staffRoles = String(staff.artist_service || staff.role || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
  const staffState = staff.state || "فعال";
  const staffPhone = staff.artist_phone || staff.phone || "";
  const staffArea = staff.artist_area || "";
  const staffBio = String(staff.artist_bio || staff.bio || "").trim();
  const staffAvatar = staff.avatar || staff.staff_avatar || "";
  const staffAccess = staff.access_level || "آرتیست";
  const staffBooked = staff.booked || "";
  const isActive = staffState === "فعال";
  const hasPublic = Boolean(staff.has_artist_profile || staff.artist_user_id);
  const isOwner = Boolean(staff.is_owner);
  const collabDays = staffBio.match(/روزها:\s*([^·]+)/)?.[1]?.trim() || "";
  const collabHours = staffBio.match(/ساعت:\s*([^·]+)/)?.[1]?.trim() || "";
  const collabShare = staffBio.match(/سهم آرتیست:\s*([^·]+)/)?.[1]?.trim() || "";

  return (
    <div
      className="artistProfileModal staffProfileModal"
      role="dialog"
      aria-modal="true"
      aria-label={`مدیریت ${staffName}`}
      onClick={onClose}
    >
      <article className="artistProfileSheet is-staffProfile smdSheet" onClick={(event) => event.stopPropagation()}>
        <header className="smdHero">
          <div className="smdAvatar">
            <img src={staffAvatar || "/profile-icon.svg"} alt="" />
            <i className={`smdDot ${isActive ? "is-active" : "is-idle"}`} aria-hidden="true" />
          </div>
          <b className="smdName">{staffName}</b>
          <span className="smdRole">
            <ServiceIcon name={staffRoles[0] || staffRole} size="xs" />
            {staffRoles.length ? staffRoles.join("، ") : staffRole}
          </span>
          <div className="smdMeta">
            <span className={`smdState ${isActive ? "is-active" : "is-idle"}`}>{staffState}</span>
            {hasPublic ? <span className="smdLinked"><ShieldCheck size={12} />عضو frfro</span> : null}
            {isOwner ? <span className="smdLinked"><ShieldCheck size={12} />خودم، مدیر سالن</span> : null}
            {staffArea ? <span><MapPin size={12} />{staffArea}</span> : null}
          </div>
        </header>

        {isOwner ? null : <div className="smdActions">
          {staffPhone ? (
            <a className="smdBtn" href={`tel:${toLatinDigits(staffPhone)}`}>
              <Phone size={15} />
              تماس
            </a>
          ) : (
            <button type="button" className="smdBtn" disabled>
              <Phone size={15} />
              شماره نداره
            </button>
          )}
          {hasPublic ? (
            <button type="button" className="smdBtn is-primary" onClick={() => onOpenPublic?.(staff)}>
              <Eye size={15} />
              صفحه‌ش
            </button>
          ) : (
            <button type="button" className="smdBtn" disabled>
              <Eye size={15} />
              صفحه نداره
            </button>
          )}
        </div>}

        {isOwner ? (
          <p className="smdSelfNote">این خودتی. از «خدمات» کارها رو به خودت بده تا نوبت‌ها به اسمت ثبت بشه؛ اگه فعلاً کار نمی‌کنی «غیرفعال» کن تا نوبت تازه برات گرفته نشه.</p>
        ) : null}

        <StaffPerformanceChart stats={stats} />

        <section className="smdSection">
          <h4>تماس و دسترسی</h4>
          <div className="smdList">
            {hasPublic ? (
              <>
                <div className="smdRow">
                  <Phone size={15} />
                  <span>تماس</span>
                  <b dir="ltr">{staffPhone ? toPersianDigits(staffPhone) : "نداره"}</b>
                </div>
                <div className="smdRow">
                  <MapPin size={15} />
                  <span>کجا</span>
                  <b>{staffArea || "نگفته"}</b>
                </div>
              </>
            ) : (
              <>
                <EditableFact
                  icon={UserRound}
                  label="اسم"
                  value={staffName}
                  placeholder="اسمش"
                  onSave={(name) => onUpdate?.(staff, { name }, "اسم ذخیره شد.")}
                />
                {isOwner ? null : <EditableFact
                  icon={Phone}
                  label="تماس"
                  value={staffPhone}
                  placeholder="شماره موبایل"
                  dir="ltr"
                  formatValue={toPersianDigits}
                  onSave={(phone) => onUpdate?.(staff, { phone }, "شماره ذخیره شد.")}
                />}
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
                <span>نوبت‌ها</span>
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
        ) : null}

        <section className="smdSection">
          <h4>کارهاش <small>{hasPublic ? "خود آرتیست انتخاب می‌کنه" : "برای نوبت و منوی سالن"}</small></h4>
          {hasPublic ? (
            <div className="smdRoles is-locked">
              {staffRoles.length ? staffRoles.map((role) => (
                <span key={role} className="smdRoleChip">
                  <ServiceIcon name={role} size="xs" />
                  {role}
                </span>
              )) : <span className="smdRoleEmpty">آرتیست هنوز کارهاش رو نگفته.</span>}
              <p className="smdLockNote"><Lock size={12} /> اینو فقط خود آرتیست از پروفایلش عوض می‌کنه.</p>
            </div>
          ) : (
            <div className="smdRoles" role="group" aria-label="کارهاش">
              {roleOptions.map((role) => {
                // The manager often does several things: their row takes any number of fields.
                const on = isOwner ? staffRoles.includes(role) : staffRole === role;
                return (
                <button
                  type="button"
                  key={role}
                  className={on ? "active" : ""}
                  aria-pressed={on}
                  onClick={() => {
                    if (isOwner) {
                      const next = on ? staffRoles.filter((item) => item !== role) : [...staffRoles, role];
                      onUpdate?.(staff, { role: next.join("، ") }, "کارهات ذخیره شد.");
                      return;
                    }
                    if (staffRole === role) return;
                    onUpdate?.(staff, { role }, `کارهای ${staffName} ذخیره شد.`);
                  }}
                >
                  <ServiceIcon name={role} size="xs" />
                  {role}
                </button>
                );
              })}
            </div>
          )}
        </section>

        <footer className="smdFooter">
          <button
            type="button"
            className="smdToggle"
            onClick={() => {
              const nextState = isActive ? "غیرفعال" : "فعال";
              onUpdate?.(staff, { state: nextState }, `وضعیت ${staffName} عوض شد.`);
            }}
          >
            {isActive ? "غیرفعالش کن" : "دوباره فعالش کن"}
          </button>
          <button type="button" className="smdEnd" onClick={() => (isOwner ? onRemove?.(staff) : setConfirmEnd(true))}>
            {isOwner ? "خودم برم بیرون از تیم" : "تموم کردن همکاری"}
          </button>
        </footer>
        {confirmEnd ? (
          <div className="smdConfirm" role="group" aria-label={`برداشتن ${staffName} از تیم`}>
            <b>«{staffName}» از تیم برداشته بشه؟</b>
            <span>این کار برگشت نداره.{hasPublic ? " بهش اعلان و پیامک می‌دیم." : ""}</span>
            {hasPublic ? (
              <label className="smdReason">
                <span>یه خط برای {staffName} (اگه خواستی)</span>
                <input
                  type="text"
                  value={endReason}
                  maxLength={120}
                  placeholder="مثلاً: ممنون از همکاریت"
                  onChange={(event) => setEndReason(event.target.value)}
                />
              </label>
            ) : null}
            <div className="smdConfirmActions">
              <button type="button" className="smdEnd" onClick={() => onRemove?.(staff, { confirmed: true, reason: endReason.trim() })}>آره، بردار</button>
              <button type="button" className="smdToggle" onClick={() => { setConfirmEnd(false); setEndReason(""); }}>نه</button>
            </div>
          </div>
        ) : null}
  <SheetClose onClick={onClose} />
      </article>
    </div>
  );
}
