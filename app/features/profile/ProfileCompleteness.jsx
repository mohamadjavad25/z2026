"use client";

import { useState } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import { isDefaultAvatar } from "../../shared/lib/defaultAvatar";
import { toPersianDigits } from "../../shared/lib/digits";
import { beautySpecialtyOptions } from "../../shared/constants/roles";
import { SpecialtyMultiSelect } from "../auth/SpecialtyMultiSelect";
import { QuickAreaSheet } from "./QuickAreaSheet";

/** What a salon / artist profile needs before clients can find and book it. Each step knows where to send the owner. */
export function getProfileSteps(profile, serviceCount) {
  const data = profile?.data || {};
  const isSalon = profile?.type === "salon";
  return [
    { id: "avatar", label: isSalon ? "لوگوی سالن" : "عکس پروفایل", done: !isDefaultAvatar(data.avatar), target: "edit" },
    { id: "area", label: "محدوده فعالیت", done: Boolean(String(data.area || "").trim()), target: "edit" },
    { id: "specialty", label: isSalon ? "خدمات اصلی" : "تخصص", done: Boolean(String(data.service || "").trim()), target: "edit" },
    { id: "services", label: "اولین خدمت در منو", done: serviceCount > 0, target: "services" }
  ];
}

const storageKey = (id) => `zibaban_completeness_dismissed_${id}`;

export function ProfileCompleteness({ profile, serviceCount = 0, onEditProfile, onOpenServices, onPickLogo, onQuickSave }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(storageKey(profile?.id)) === "1";
    } catch {
      return false;
    }
  });
  // Which one-tap sheet is open: "area" | "specialty" | null.
  const [quick, setQuick] = useState(null);
  if (!profile || (profile.type !== "salon" && profile.type !== "artist")) return null;
  const steps = getProfileSteps(profile, serviceCount);
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length || dismissed) return null;
  const percent = Math.round((done / steps.length) * 100);

  return (
    <section className="profileCompleteness" aria-label="تکمیل پروفایل">
      <header>
        <div>
          <strong>پروفایلت {toPersianDigits(percent)}٪ کامل است</strong>
          <small>با تکمیلش راحت‌تر پیدا می‌شوی و رزرو بیشتری می‌گیری.</small>
        </div>
        <button
          type="button"
          className="profileCompletenessClose"
          aria-label="بستن یادآوری تکمیل پروفایل"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(storageKey(profile.id), "1");
            } catch {
              // the card just comes back next visit
            }
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="profileCompletenessBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="میزان تکمیل پروفایل">
        <i style={{ width: `${percent}%` }} />
      </div>
      <ul>
        {steps.map((step) => (
          <li key={step.id} className={step.done ? "is-done" : ""}>
            {step.done ? (
              <span><CheckCircle2 size={16} aria-hidden="true" />{step.label}</span>
            ) : step.id === "avatar" && onPickLogo ? (
              // Same flow as Settings: pick a photo, then frame/zoom it in the crop editor.
              <label className="profileCompletenessPick">
                <Circle size={16} aria-hidden="true" />
                {step.label}
                <input className="captureInput" type="file" accept="image/*" onChange={onPickLogo} />
              </label>
            ) : onQuickSave && (step.id === "area" || step.id === "specialty") ? (
              <button type="button" onClick={() => setQuick(step.id)}>
                <Circle size={16} aria-hidden="true" />
                {step.label}
              </button>
            ) : (
              <button type="button" onClick={() => (step.target === "services" ? onOpenServices?.() : onEditProfile?.())}>
                <Circle size={16} aria-hidden="true" />
                {step.label}
              </button>
            )}
          </li>
        ))}
      </ul>
      <QuickAreaSheet
        open={quick === "area"}
        onClose={() => setQuick(null)}
        onPick={(area) => {
          setQuick(null);
          onQuickSave?.({ area }, { successMessage: `محدوده فعالیت: ${area}` });
        }}
      />
      {quick === "specialty" ? (
        <SpecialtyMultiSelect
          hideTrigger
          defaultOpen
          options={beautySpecialtyOptions}
          defaultValue={profile.data?.service || ""}
          onDismiss={() => setQuick(null)}
          onDone={(selected) => {
            setQuick(null);
            onQuickSave?.({ service: selected.join("، ") }, { successMessage: "حوزه فعالیت ذخیره شد." });
          }}
        />
      ) : null}
    </section>
  );
}
