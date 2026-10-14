"use client";

import { useState } from "react";
import { ArrowLeft, ImagePlus, ListPlus, MapPin, Sparkles, X } from "lucide-react";
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

// Icon + one-line "why it matters" per step: owners see the benefit, not just a task name.
const STEP_META = {
  avatar: { Icon: ImagePlus, hint: "با لوگو، مشتری زودتر اعتماد می‌کند" },
  area: { Icon: MapPin, hint: "تا در جستجوی شهرت پیدا شوی" },
  specialty: { Icon: Sparkles, hint: "مشتری بداند چه کاری انجام می‌دهی" },
  services: { Icon: ListPlus, hint: "قیمت و رزرو مستقیم برای مشتری" }
};

const RING_RADIUS = 24;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function ProfileCompleteness({ profile, serviceCount = 0, onEditProfile, onOpenServices, onPickLogo, onQuickSave }) {
  // Closing only hides the card for this visit; it is not remembered, so every refresh brings it back until the profile is complete.
  const [dismissed, setDismissed] = useState(false);
  // Which one-tap sheet is open: "area" | "specialty" | null.
  const [quick, setQuick] = useState(null);
  if (!profile || (profile.type !== "salon" && profile.type !== "artist")) return null;
  const steps = getProfileSteps(profile, serviceCount);
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length || dismissed) return null;
  const percent = Math.round((done / steps.length) * 100);

  const pending = steps.filter((step) => !step.done);
  const remaining = pending.length;

  function rowAction(step) {
    if (step.id === "avatar" && onPickLogo) return { kind: "file" };
    if (onQuickSave && (step.id === "area" || step.id === "specialty")) return { kind: "click", run: () => setQuick(step.id) };
    return { kind: "click", run: () => (step.target === "services" ? onOpenServices?.() : onEditProfile?.()) };
  }

  return (
    <section className="profileCompleteness" aria-label="تکمیل پروفایل">
      <header className="pccHead">
        <div className="pccRing" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="میزان تکمیل پروفایل">
          <svg viewBox="0 0 56 56" aria-hidden="true">
            <defs>
              <linearGradient id="pccGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6b3fb0" />
                <stop offset="100%" stopColor="#e11d74" />
              </linearGradient>
            </defs>
            <circle className="pccRingTrack" cx="28" cy="28" r={RING_RADIUS} />
            <circle
              className="pccRingFill"
              cx="28"
              cy="28"
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - percent / 100)}
            />
          </svg>
          <b>{toPersianDigits(percent)}٪</b>
        </div>
        <div className="pccCopy">
          <strong>{remaining === 1 ? "فقط یک قدم مانده" : `${toPersianDigits(remaining)} قدم تا پروفایل کامل`}</strong>
          <small>پروفایل کامل‌تر، دیده شدن و رزرو بیشتر؛ مشتری‌ها پروفایل‌های پر را جدی‌تر می‌گیرند.</small>
        </div>
        <button type="button" className="profileCompletenessClose" aria-label="بستن یادآوری تکمیل پروفایل" onClick={() => setDismissed(true)}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="pccSteps" aria-hidden="true">
        {steps.map((step) => (
          <i key={step.id} className={step.done ? "is-done" : ""} />
        ))}
      </div>

      <ul className="pccList">
        {pending.map((step, index) => {
          const { Icon, hint } = STEP_META[step.id] || STEP_META.services;
          const action = rowAction(step);
          const body = (
            <>
              <span className="pccIcon" aria-hidden="true"><Icon size={20} /></span>
              <span className="pccText">
                <b>{step.label}</b>
                <small>{hint}</small>
              </span>
              <span className="pccGo" aria-hidden="true"><ArrowLeft size={16} /></span>
            </>
          );
          const className = index === 0 ? "pccRow is-next" : "pccRow";
          return (
            <li key={step.id}>
              {action.kind === "file" ? (
                // Same flow as Settings: pick a photo, then frame/zoom it in the crop editor.
                <label className={className}>
                  {body}
                  <input className="captureInput" type="file" accept="image/*" onChange={onPickLogo} />
                </label>
              ) : (
                <button type="button" className={className} onClick={action.run}>{body}</button>
              )}
            </li>
          );
        })}
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
