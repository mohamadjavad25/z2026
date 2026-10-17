"use client";

import { useState } from "react";
import { ArrowLeft, Check, ImagePlus, ListPlus, MapPin, Sparkles, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { beautySpecialtyOptions } from "../../shared/constants/roles";
import { SpecialtyMultiSelect } from "../auth/SpecialtyMultiSelect";
import { Button } from "../../components/ui/Button";
import { ProfileSheet } from "./ProfileSheet";
import { QuickAreaPicker } from "./QuickAreaSheet";

// Icon + one-line "why it matters" per step: owners see the benefit, not just a task name.
export const STEP_META = {
  avatar: { Icon: ImagePlus, hint: "با لوگو، مشتری زودتر اعتماد می‌کند" },
  area: { Icon: MapPin, hint: "تا در جستجوی شهرت پیدا شوی" },
  specialty: { Icon: Sparkles, hint: "مشتری بداند چه کاری انجام می‌دهی" },
  services: { Icon: ListPlus, hint: "قیمت و رزرو مستقیم برای مشتری" }
};

// What the guided screen says for each step (the checklist card only needs the label + hint above).
const STEP_COPY = {
  avatar: (isSalon) => ({
    title: isSalon ? "لوگوی سالنت را بگذار" : "عکس پروفایلت را بگذار",
    lead: "یک عکس واضح، اولین چیزی است که مشتری می‌بیند. بعد از انتخاب، قابش را خودت تنظیم می‌کنی."
  }),
  area: () => ({
    title: "کجا کار می‌کنی؟",
    lead: "شهرت را انتخاب کن تا مشتری‌های همان اطراف تو را در جستجو پیدا کنند."
  }),
  specialty: (isSalon) => ({
    title: isSalon ? "خدمات اصلی سالن چیست؟" : "تخصصت چیست؟",
    lead: "هر چند مورد که انجام می‌دهی انتخاب کن؛ بعداً هر وقت خواستی عوض می‌شود."
  }),
  services: () => ({
    title: "اولین خدمتت را به منو اضافه کن",
    lead: "با اسم و قیمت، مشتری می‌تواند همان‌جا مستقیم برایت نوبت بگیرد."
  })
};

/**
 * Guided "finish your profile" flow. One open step at a time, in order, inside a single sheet:
 * the owner never has to leave and come back for the next one. The current step is *derived*
 * from the profile (first step not done and not skipped), so it advances by itself the moment a
 * save lands -- including the logo, whose crop editor lives elsewhere.
 */
export function ProfileCompletionFlow({
  open,
  isSalon,
  steps,
  skipped,
  profile,
  logoEditing = false,
  onClose,
  onSkip,
  onPickLogo,
  onQuickSave,
  onOpenServices
}) {
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  const current = steps.find((step) => !step.done && !skipped.includes(step.id));
  const allDone = steps.every((step) => step.done);
  const index = current ? steps.findIndex((step) => step.id === current.id) : steps.length;

  async function save(fields, successMessage) {
    setSaving(true);
    try {
      await onQuickSave?.(fields, { successMessage });
    } finally {
      setSaving(false);
    }
  }

  function openServices() {
    onClose();
    onOpenServices?.();
  }

  const meta = current ? STEP_META[current.id] || STEP_META.services : null;
  const copy = current ? (STEP_COPY[current.id] || STEP_COPY.services)(isSalon) : null;

  return (
    // While the logo crop editor is open on top, Escape / back must close only that editor.
    <ProfileSheet open hideHeader hideClose label="تکمیل پروفایل" panelClassName="pcfSheet" onClose={logoEditing ? () => {} : onClose}>
      <div className="pcfTop">
        <span className="pcfCount">
          {allDone ? "تمام شد" : `قدم ${toPersianDigits(Math.min(index + 1, steps.length))} از ${toPersianDigits(steps.length)}`}
        </span>
        <button type="button" className="pcfClose" aria-label="بستن" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <ol className="pcfDots" aria-hidden="true">
        {steps.map((step, i) => (
          <li key={step.id} className={step.done ? "is-done" : !allDone && i === index ? "is-current" : ""}>
            {step.done ? <Check size={11} /> : null}
          </li>
        ))}
      </ol>

      {allDone ? (
        <div className="pcfStep pcfFinale" key="finale">
          <span className="pcfFinaleBadge" aria-hidden="true"><Check size={40} /></span>
          <h3>پروفایلت کامل شد</h3>
          <p>حالا مشتری‌ها راحت‌تر پیدایت می‌کنند و بیشتر به رزرو اعتماد می‌کنند.</p>
          <div className="pcfFooter">
            <Button block onClick={onClose}>دیدن پروفایل</Button>
          </div>
        </div>
      ) : current ? (
        <div className="pcfStep" key={current.id}>
          <header className="pcfHero">
            <span className="pcfHeroIcon" aria-hidden="true"><meta.Icon size={26} /></span>
            <h3>{copy.title}</h3>
            <p>{copy.lead}</p>
          </header>

          <div className="pcfBody">
            {current.id === "avatar" ? (
              <label className="pcfPick">
                <span className="pcfPickDisc" aria-hidden="true"><ImagePlus size={34} /></span>
                <b>انتخاب عکس از گالری</b>
                <small>اندازه و قاب را بعد از انتخاب تنظیم می‌کنی</small>
                <input className="captureInput" type="file" accept="image/*" onChange={onPickLogo} />
              </label>
            ) : null}

            {current.id === "area" ? (
              <div className="pcfArea">
                <QuickAreaPicker disabled={saving} onPick={(area) => save({ area }, `محدوده فعالیت: ${area}`)} />
              </div>
            ) : null}

            {current.id === "specialty" ? (
              <SpecialtyMultiSelect
                inline
                options={beautySpecialtyOptions}
                defaultValue={profile?.data?.service || ""}
                disabled={saving}
                onDone={(selected) => save({ service: selected.join("، ") }, "حوزه فعالیت ذخیره شد.")}
              />
            ) : null}

            {current.id === "services" ? (
              <Button block icon={ArrowLeft} onClick={openServices}>افزودن اولین خدمت</Button>
            ) : null}
          </div>

          <div className="pcfFooter">
            <button type="button" className="pcfSkip" disabled={saving} onClick={() => onSkip(current.id)}>
              الان نه، بعداً
            </button>
          </div>
        </div>
      ) : null}
    </ProfileSheet>
  );
}
