"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { isDefaultAvatar } from "../../shared/lib/defaultAvatar";
import { toPersianDigits } from "../../shared/lib/digits";
import { beautySpecialtyOptions } from "../../shared/constants/roles";
import { SpecialtyMultiSelect } from "../auth/SpecialtyMultiSelect";
import { QuickAreaSheet } from "./QuickAreaSheet";
import { ProfileCompletionFlow, STEP_META } from "./ProfileCompletionFlow";

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

const RING_RADIUS = 24;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function ProfileCompleteness({ profile, serviceCount = 0, logoEditing = false, onEditProfile, onOpenServices, onPickLogo, onQuickSave }) {
  // Closing only hides the card for this visit; it is not remembered, so every refresh brings it back until the profile is complete.
  const [dismissed, setDismissed] = useState(false);
  // Which one-tap sheet is open: "area" | "specialty" | null.
  const [quick, setQuick] = useState(null);
  // The guided flow: all open steps in a row, in one sheet. `skipped` only lasts for the current run.
  const [flowOpen, setFlowOpen] = useState(false);
  const [skipped, setSkipped] = useState([]);

  const isOwner = Boolean(profile) && (profile.type === "salon" || profile.type === "artist");
  const steps = isOwner ? getProfileSteps(profile, serviceCount) : [];
  const done = steps.filter((step) => step.done).length;
  const allDone = isOwner && done === steps.length;
  const nothingLeft = isOwner && !allDone && steps.every((step) => step.done || skipped.includes(step.id));

  // Every open step was skipped: the run is over, back to the card.
  useEffect(() => {
    if (flowOpen && nothingLeft) setFlowOpen(false);
  }, [flowOpen, nothingLeft]);

  if (!isOwner) return null;

  const isSalon = profile.type === "salon";
  const flow = (
    <ProfileCompletionFlow
      open={flowOpen}
      isSalon={isSalon}
      steps={steps}
      skipped={skipped}
      profile={profile}
      logoEditing={logoEditing}
      onClose={() => setFlowOpen(false)}
      onSkip={(id) => setSkipped((prev) => [...prev, id])}
      onPickLogo={onPickLogo}
      onQuickSave={onQuickSave}
      onOpenServices={onOpenServices}
    />
  );

  // Finished while the flow is open: the sheet shows the closing screen, the card is already gone.
  if (allDone) return flow;
  if (dismissed && !flowOpen) return null;

  const percent = Math.round((done / steps.length) * 100);
  const pending = steps.filter((step) => !step.done);
  const remaining = pending.length;

  function startFlow() {
    setSkipped([]);
    setFlowOpen(true);
  }

  // Tapping the card anywhere starts the guided flow; the rows, the close button and the
  // start button keep their own jobs.
  function handleCardClick(event) {
    if (event.target.closest("button, a, label, input")) return;
    startFlow();
  }

  function rowAction(step) {
    if (step.id === "avatar" && onPickLogo) return { kind: "file" };
    if (onQuickSave && (step.id === "area" || step.id === "specialty")) return { kind: "click", run: () => setQuick(step.id) };
    return { kind: "click", run: () => (step.target === "services" ? onOpenServices?.() : onEditProfile?.()) };
  }

  return (
    <>
      {dismissed ? null : (
        <section className="profileCompleteness" aria-label="تکمیل پروفایل" onClick={handleCardClick}>
          <header className="pccHead">
            <div className="pccRing" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="میزان تکمیل پروفایل">
              <svg viewBox="0 0 56 56" aria-hidden="true">
                <defs>
                  <linearGradient id="pccGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8b6cff" />
                    <stop offset="100%" stopColor="#ff86b8" />
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

          <ol className="pccChecks" aria-label="مراحل تکمیل">
            {steps.map((step) => (
              <li key={step.id} className={step.done ? "is-done" : ""}>
                <i aria-hidden="true">{step.done ? <Check size={10} /> : null}</i>
                {step.label}
              </li>
            ))}
          </ol>

          <ul className="pccList">
            {pending.map((step) => {
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
              return (
                <li key={step.id}>
                  {action.kind === "file" ? (
                    // Same flow as Settings: pick a photo, then frame/zoom it in the crop editor.
                    <label className="pccRow">
                      {body}
                      <input className="captureInput" type="file" accept="image/*" onChange={onPickLogo} />
                    </label>
                  ) : (
                    <button type="button" className="pccRow" onClick={action.run}>{body}</button>
                  )}
                </li>
              );
            })}
          </ul>

          <button type="button" className="pccStart" onClick={startFlow}>
            <span>{remaining === 1 ? "تکمیلش کن" : "قدم‌به‌قدم کامل کن"}</span>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        </section>
      )}

      {flow}

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
    </>
  );
}
