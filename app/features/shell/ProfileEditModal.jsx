"use client";

import { useEffect, useState } from "react";
import { Camera, Check, ChevronDown, KeyRound, X } from "lucide-react";
import { defaultAvatarFor } from "../../shared/lib/defaultAvatar";
import { beautySpecialtyOptions } from "../../shared/constants/roles";
import { SpecialtyMultiSelect } from "../auth/SpecialtyMultiSelect";

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
  saving = false
}) {
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
  const title = isSalon ? "ویرایش اطلاعات سالن" : "ویرایش پروفایل";

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
            <span>برای تغییر {isSalon ? "لوگو" : "عکس"} روی تصویر بزن</span>
          </div>
          <button type="button" className="peClose" onClick={onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </header>

        <div className="peBody">
          <section className="peGroup" aria-labelledby="pe-basics">
            <h4 id="pe-basics">{isSalon ? "برند سالن" : "اطلاعات پایه"}</h4>
            <label className="peField">
              <span>{isSalon ? "نام سالن" : "نام"}</span>
              <input name="name" defaultValue={profile.data?.name || ""} autoComplete="name" required />
            </label>
            {hasActivityField ? (
              <div className="peField">
                <span>حوزه فعالیت</span>
                <SpecialtyMultiSelect
                  name="service"
                  placeholder={isSalon ? "خدمات اصلی سالن را انتخاب کن" : "تخصص‌هایت را انتخاب کن"}
                  options={beautySpecialtyOptions}
                  defaultValue={profile.data?.service || ""}
                  required
                />
                <small>
                  {isSalon
                    ? "این در معرفی سالن شما نمایش داده می‌شود."
                    : "فقط خودت این را تعیین می‌کنی؛ سالن‌ها آن را در تیمشان می‌بینند."}
                </small>
              </div>
            ) : null}
            {isSalon ? (
              <div className="peRow">
                <label className="peField">
                  <span>نام مدیر سالن</span>
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
            <label className="peField">
              <span>شماره موبایل</span>
              <input
                name="phone"
                defaultValue={profile.data?.phone || ""}
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                maxLength={11}
                placeholder="09123456789"
              />
            </label>
            <label className="peField">
              <span>ایمیل <em>اختیاری، برای اطلاع‌رسانی و بازیابی حساب</em></span>
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
              <span id="pe-security">تغییر رمز عبور</span>
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
                    <span>رمز جدید</span>
                    <input name="password" type="password" autoComplete="new-password" placeholder="حداقل ۸ کاراکتر" />
                  </label>
                  <label className="peField">
                    <span>تکرار رمز جدید</span>
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
            {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
          </button>
        </footer>
      </form>
    </div>
  );
}
