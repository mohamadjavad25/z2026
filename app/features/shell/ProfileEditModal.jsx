"use client";

import { useEffect, useState } from "react";
import { Camera, Check, CheckCircle2, Mail, Phone, ShieldCheck, UserRound, X } from "lucide-react";

/**
 * Registered profile edit modal.
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
  const [stepIndex, setStepIndex] = useState(0);
  // The "بعدی" (next) button turns into the "ذخیره تغییرات" (save & close)
  // submit button the moment the last step is reached, in the exact same
  // spot — a habitual second tap right after landing there (very common
  // on mobile) used to submit and close the whole modal before anyone got
  // a chance to type a new password. A brief guard keeps that same tap
  // from landing on the now-different button underneath it.
  const [justArrived, setJustArrived] = useState(false);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    setJustArrived(true);
    const timer = setTimeout(() => setJustArrived(false), 500);
    return () => clearTimeout(timer);
  }, [stepIndex]);

  if (!open || !profile) return null;
  const isSalon = profile.type === "salon";
  const avatarSrc = avatarDraft || profile.data?.avatar || "/profile-icon.svg";
  const rawExperienceYears = profile.data?.experienceYears ?? "";
  const experienceYears = /^\d{1,2}$/.test(String(rawExperienceYears)) ? rawExperienceYears : "";
  const managerName = profile.data?.managerName || "";
  const completionSteps = [
    {
      key: "identity",
      label: isSalon ? "برند و مدیر" : "هویت",
      done: Boolean(profile.data?.name && (!isSalon || managerName) && avatarSrc),
      Icon: UserRound
    },
    {
      key: "contact",
      label: "تماس",
      done: Boolean(profile.data?.phone && profile.data?.email),
      Icon: Phone
    },
    {
      key: "trust",
      label: "امنیت",
      done: true,
      Icon: ShieldCheck
    }
  ];
  const lastStepIndex = completionSteps.length - 1;

  return (
    <div
      className="artistProfileModal profileEditModal"
      role="dialog"
      aria-modal="true"
      aria-label="ویرایش پروفایل"
      onClick={onClose}
    >
      <article className="artistProfileSheet artistCreateSheet profileEditSheet" onClick={(event) => event.stopPropagation()}>
        <form className="artistProfileForm artistCreatePopupForm profileEditForm" onSubmit={onSubmit}>
          <header className="profileEditHero">
            <div className="profileEditAvatarBlock">
              <label className="profileEditAvatarUpload" title="آپلود عکس پروفایل">
                <span className="profileEditAvatarPreview">
                  <img src={avatarSrc} alt="" />
                </span>
                <span className="profileEditAvatarIcon" aria-hidden="true">
                  <Camera size={16} />
                </span>
                <input className="captureInput" type="file" accept="image/*" onChange={onAvatarUpload} />
              </label>
            </div>
            <div className="profileEditHeroCopy">
              <span>{isSalon ? "تکمیل پروفایل سالن" : "ویرایش پروفایل"}</span>
              <strong>{completionSteps[stepIndex]?.label || "اطلاعات اصلی"}</strong>
            </div>
          </header>

          <div
            className="profileEditProgress"
            aria-label="مراحل تکمیل پروفایل"
            style={{ "--profile-edit-progress": String(stepIndex / Math.max(1, lastStepIndex)) }}
          >
            <div
              className="profileEditProgressTrack"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                alignItems: "start",
                width: "100%"
              }}
            >
              <span
                className={`profileEditProgressSegment is-first ${stepIndex >= 1 ? "is-active" : ""}`}
                aria-hidden="true"
              />
              <span
                className={`profileEditProgressSegment is-second ${stepIndex >= 2 ? "is-active" : ""}`}
                aria-hidden="true"
              />
              {completionSteps.map(({ key, label, done, Icon }, index) => (
                <button
                  key={key}
                  type="button"
                  className={`${done ? "is-done" : ""} ${index === stepIndex ? "is-active" : ""}`}
                  aria-label={label}
                  title={label}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    display: "grid",
                    placeItems: "center"
                  }}
                  onClick={() => setStepIndex(index)}
                >
                  {done ? <CheckCircle2 size={15} /> : <Icon size={15} />}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="profileEditFields">
            <section className={`profileEditSection ${stepIndex === 0 ? "is-active" : ""}`} aria-hidden={stepIndex !== 0}>
              <div className="profileEditSectionHead">
                <UserRound size={18} />
                <strong>{isSalon ? "برند سالن و مدیر" : "هویت اصلی"}</strong>
              </div>
              <div className="profileEditFieldGrid">
                <label>{isSalon ? "نام سالن" : "نام"}<input name="name" defaultValue={profile.data?.name || ""} /></label>
                {isSalon ? (
                  <>
                    <label>نام مدیر سالن<input name="managerName" defaultValue={managerName} placeholder="مثلاً مریم یوسفی" /></label>
                    <label className="profileEditYearsField">
                      تجربه کاری
                      <span className="profileEditYearsControl">
                        <input
                          name="experienceYears"
                          defaultValue={experienceYears}
                          type="number"
                          min="0"
                          max="80"
                          inputMode="numeric"
                          placeholder="۴"
                        />
                        <small>سال</small>
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
            </section>

            <section className={`profileEditSection ${stepIndex === 1 ? "is-active" : ""}`} aria-hidden={stepIndex !== 1}>
              <div className="profileEditSectionHead">
                <Mail size={18} />
                <strong>اطلاعات تماس</strong>
              </div>
              <div className="profileEditFieldGrid">
                <label>شماره تماس<input name="phone" defaultValue={profile.data?.phone || ""} inputMode="tel" dir="ltr" maxLength={11} /></label>
                <label>ایمیل <small>اختیاری اما مهم</small><input name="email" defaultValue={profile.data?.email || ""} type="email" placeholder="برای اطلاع‌رسانی و بازیابی حساب" /></label>
              </div>
            </section>

            <section className={`profileEditSection ${stepIndex === 2 ? "is-active" : ""}`} aria-hidden={stepIndex !== 2}>
              <div className="profileEditSectionHead">
                <ShieldCheck size={18} />
                <strong>امنیت حساب</strong>
              </div>
              <div className="profileEditFieldGrid">
                <label className="profileEditPasswordWide">رمز فعلی<input name="currentPassword" placeholder="فقط اگر رمز را تغییر می‌دهی" type="password" autoComplete="current-password" /></label>
                <label>رمز عبور جدید<input name="password" placeholder="خالی بگذار اگر تغییر نمی‌دهی" type="password" autoComplete="new-password" /></label>
                <label>تکرار رمز جدید<input name="passwordConfirm" placeholder="تکرار رمز جدید" type="password" autoComplete="new-password" /></label>
              </div>
            </section>
          </div>
          <input type="hidden" name="area" value={profile.data?.area || ""} />
          <input type="hidden" name="service" value={profile.data?.service || ""} />
          <div
            className="profileEditStepActions"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              alignItems: "stretch",
              gap: 8
            }}
          >
            {stepIndex < lastStepIndex ? (
              <button
                key="next"
                type="button"
                style={{ width: "100%", minWidth: 0 }}
                onClick={() => setStepIndex((index) => Math.min(lastStepIndex, index + 1))}
              >
                بعدی
              </button>
            ) : (
              <button
                key="submit"
                type="submit"
                className="profileEditSaveBtn"
                disabled={justArrived || saving}
                style={{ width: "100%", minWidth: 0 }}
              >
                <Check size={16} /> {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
              </button>
            )}
            <button
              type="button"
              className="is-secondary"
              style={{ width: "100%", minWidth: 0 }}
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            >
              قبلی
            </button>
          </div>
        </form>
      </article>
      <button type="button" className="profileEditClose" onClick={onClose} aria-label="بستن">
        <X size={18} />
      </button>
    </div>
  );
}
