"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { isDefaultAvatar } from "../../shared/lib/defaultAvatar";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileCompletionFlow } from "./ProfileCompletionFlow";

/** What a salon / artist profile needs before clients can find and book it. */
export function getProfileSteps(profile, serviceCount) {
  const data = profile?.data || {};
  const isSalon = profile?.type === "salon";
  return [
    { id: "avatar", label: isSalon ? "لوگوی سالن" : "عکس پروفایل", done: !isDefaultAvatar(data.avatar) },
    { id: "area", label: "جات روی نقشه", done: Boolean(String(data.area || "").trim()) },
    { id: "specialty", label: isSalon ? "خدمات اصلی" : "تخصص", done: Boolean(String(data.service || "").trim()) },
    { id: "services", label: "اولین خدمت در منو", done: serviceCount > 0 }
  ];
}

const RING_RADIUS = 24;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The reminder card on the owner's dashboard. It has no per-step links on purpose: tapping the
 * card (or its button) opens the guided flow, which takes the open steps one after another.
 */
export function ProfileCompleteness({ profile, serviceCount = 0, logoEditing = false, onOpenServices, onPickLogo, onQuickSave }) {
  // Closing only hides the card for this visit; it is not remembered, so every refresh brings it back until the profile is complete.
  const [dismissed, setDismissed] = useState(false);
  // The guided flow.
  const [flowOpen, setFlowOpen] = useState(false);

  const isOwner = Boolean(profile) && (profile.type === "salon" || profile.type === "artist");
  const steps = isOwner ? getProfileSteps(profile, serviceCount) : [];
  const done = steps.filter((step) => step.done).length;
  const allDone = isOwner && done === steps.length;

  if (!isOwner) return null;

  const flow = (
    <ProfileCompletionFlow
      open={flowOpen}
      isSalon={profile.type === "salon"}
      steps={steps}
      profile={profile}
      logoEditing={logoEditing}
      onClose={() => setFlowOpen(false)}
      onPickLogo={onPickLogo}
      onQuickSave={onQuickSave}
      onOpenServices={onOpenServices}
    />
  );

  // Finished while the flow is open: the sheet shows the closing screen, the card is already gone.
  if (allDone) return flow;
  if (dismissed) return flow;

  const percent = Math.round((done / steps.length) * 100);
  const remaining = steps.length - done;

  function startFlow() {
    setFlowOpen(true);
  }

  // Tapping the card anywhere starts the flow; the close button keeps its own job.
  function handleCardClick(event) {
    if (event.target.closest("button")) return;
    startFlow();
  }

  return (
    <>
      {/* One slim row (user's choice 2026-10-23): the day's bookings below it stay the first thing on screen. */}
      <section className="profileCompleteness" aria-label="تکمیل پروفایل" onClick={handleCardClick}>
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
        </div>
        <div className="pccCopy">
          <strong>صفحه‌ت {toPersianDigits(percent)}٪ آماده‌ست</strong>
          <small>{remaining === 1 ? "فقط یه قدم دیگه" : `${toPersianDigits(remaining)} قدم دیگه`}</small>
        </div>
        <button type="button" className="pccStart" onClick={startFlow}>بریم</button>
        <button type="button" className="profileCompletenessClose" aria-label="بستن یادآوری تکمیل پروفایل" onClick={() => setDismissed(true)}>
          <X size={16} aria-hidden="true" />
        </button>
      </section>
      {flow}
    </>
  );
}
