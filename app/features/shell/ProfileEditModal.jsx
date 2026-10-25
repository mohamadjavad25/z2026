"use client";

import { useEffect, useState } from "react";
import { Camera, Check, ChevronDown, KeyRound, X } from "lucide-react";
import { defaultAvatarFor } from "../../shared/lib/defaultAvatar";
import { beautySpecialtyOptions } from "../../shared/constants/roles";
import { SpecialtyMultiSelect } from "../auth/SpecialtyMultiSelect";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { PhoneChangeBox } from "./PhoneChangeBox";

/**
 * Registered profile edit sheet: one tidy scrolling page with three groups
 * (basics, contact, password) and a single save button that stays in reach.
 * Presentational: open/avatar/profile + submit/upload callbacks from HomeApp.
 */
export function ProfileEditModal({
  open,
  profile,
  avatarDraft = "",
  onClose,
  onAvatarUpload,
  onSubmit,
  onPhoneChanged,
  saving = false
}) {
  useBackHandler(Boolean(open && profile), onClose);
  // The password fields only exist while the section is open, so a closed
  // section can never send (or autofill) anything by accident.
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    if (open) setPasswordOpen(false);
  }, [open]);

  if (!open || !profile) return null;

  const isSalon = profile.type === "salon";
  // Field of activity exists for artists and salons only; clients have none.
  const hasActivityField = profile.type === "artist" || isSalon;
  const avatarSrc = avatarDraft || profile.data?.avatar || defaultAvatarFor(profile.type);
  const rawExperienceYears = profile.data?.experienceYears ?? "";
  const experienceYears = /^\d{1,2}$/.test(String(rawExperienceYears)) ? rawExperienceYears : "";
  const title = isSalon ? "اطلاعات سالن" : "پروفایلت";

  return (
    <div className="peBackdrop" role="dialog" aria-modal="true" aria-label="ویرایش پروفایل" onClick={onClose}>
      <form className="peSheet" onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}>
        <header className="peHead">
          <label className="peAvatar" title="تغییر عکس">
            <img src={avatarSrc} alt="" />
            <span className="peAvatarBadge" aria-hidden="true"><Camera size={14} /></span>
            <input className="captureInput" type="file" accept="image/*" onChange={onAvatarUpload} />
          </label>
          <div className="peHeadCopy">
            <h3>{title}</h3>
            <span>برای عوض کردن {isSalon ? "لوگو" : "عکس"} روش بزن</span>
          </div>
          <button type="button" className="peClose" onClick={onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </header>

        <div className="peBody">
          <section className="peGroup" aria-labelledby="pe-basics">
            <h4 id="pe-basics">{isSalon ? "سالنت" : "خودت"}</h4>
            <label className="peField">
              <span>{isSalon ? "اسم سالن" : "اسم"}</span>
              <input name="name" defaultValue={profile.data?.name || ""} autoComplete="name" required />
            </label>
            {hasActivityField ? (
              <div className="peField">
                <span>چه کارهایی می‌کنی؟</span>
                <SpecialtyMultiSelect
                  name="service"
                  placeholder={isSalon ? "کارهای اصلی سالن رو انتخاب کن" : "کارهات رو انتخاب کن"}
                  options={beautySpecialtyOptions}
                  defaultValue={profile.data?.service || ""}
                  required
                />
                <small>
                  {isSalon
                    ? "توی معرفی سالنت دیده می‌شه."
                    : "فقط خودت انتخابش می‌کنی؛ سالن‌ها توی تیمشون می‌بیننش."}
                </small>
              </div>
            ) : null}
            {isSalon ? (
              <div className="peRow">
                <label className="peField">
                  <span>اسم مدیر سالن</span>
                  <input name="managerName" defaultValue={profile.data?.managerName || ""} placeholder="مثلاً مریم یوسفی" />
                </label>
                <label className="peField peField--narrow">
                  <span>تجربه (سال)</span>
                  <input
                    name="experienceYears"
                    defaultValue={experienceYears}
                    type="number"
                    min="0"
                    max="80"
                    inputMode="numeric"
                    placeholder="۴"
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="peGroup" aria-labelledby="pe-contact">
            <h4 id="pe-contact">تماس</h4>
            <PhoneChangeBox phone={profile.data?.phone || ""} onChanged={onPhoneChanged} />
            <label className="peField">
              <span>ایمیل <em>اگه بخوای؛ برای خبرها و وقتی رمزت یادت رفت</em></span>
              <input
                name="email"
                defaultValue={profile.data?.email || ""}
                type="email"
                autoComplete="email"
                dir="ltr"
                placeholder="name@example.com"
              />
            </label>
          </section>

          <section className="peGroup" aria-labelledby="pe-security">
            <button
              type="button"
              className="peToggle"
              aria-expanded={passwordOpen}
              onClick={() => setPasswordOpen((value) => !value)}
            >
              <KeyRound size={17} aria-hidden="true" />
              <span id="pe-security">عوض کردن رمز</span>
              <ChevronDown size={17} aria-hidden="true" className="peToggleChevron" />
            </button>
            {passwordOpen ? (
              <div className="peSecurity">
                <label className="peField">
                  <span>رمز فعلی</span>
                  <input name="currentPassword" type="password" autoComplete="current-password" />
                </label>
                <div className="peRow">
                  <label className="peField">
                    <span>رمز تازه</span>
                    <input name="password" type="password" autoComplete="new-password" placeholder="دست‌کم ۸ حرف" />
                  </label>
                  <label className="peField">
                    <span>رمز تازه، یه بار دیگه</span>
                    <input name="passwordConfirm" type="password" autoComplete="new-password" />
                  </label>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {hasActivityField ? null : <input type="hidden" name="service" value={profile.data?.service || ""} />}

        <footer className="peFoot">
          <button type="submit" className="peSave" disabled={saving}>
            <Check size={17} aria-hidden="true" />
            {saving ? "دارم ذخیره می‌کنم…" : "ذخیره کن"}
          </button>
        </footer>
      </form>
    </div>
  );
}
