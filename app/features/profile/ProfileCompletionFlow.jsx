"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, ListPlus, MapPin, Sparkles, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { beautySpecialtyOptions } from "../../shared/constants/roles";
import { SpecialtyMultiSelect } from "../auth/SpecialtyMultiSelect";
import { Button } from "../../components/ui/Button";
import { ProfileSheet } from "./ProfileSheet";
import { MapPinPicker } from "./MapPinPicker";

const STEP_ICONS = { avatar: ImagePlus, area: MapPin, specialty: Sparkles, services: ListPlus };

const STEP_COPY = {
  avatar: (isSalon) => ({
    title: isSalon ? "لوگوی سالنت رو بذار" : "یه عکس از خودت بذار",
    lead: "اولین چیزیه که مشتری می‌بینه. انتخابش که کردی، قابش رو خودت تنظیم می‌کنی."
  }),
  area: () => ({
    title: "کجا کار می‌کنی؟",
    lead: "جات رو روی نقشه پیدا می‌کنیم؛ اگه درست نبود، پین رو جابه‌جا کن. مشتری‌های همون دور و بر پیدات می‌کنن."
  }),
  specialty: (isSalon) => ({
    title: isSalon ? "کارهای اصلی سالنت چیه؟" : "چه کارهایی می‌کنی؟",
    lead: "هر چندتا که انجام می‌دی انتخاب کن؛ هر وقت خواستی عوضش کن."
  }),
  services: () => ({
    title: "اولین خدمتت رو بذار توی منو",
    lead: "با اسم و قیمت، مشتری همون‌جا ازت نوبت می‌گیره."
  })
};

/**
 * Guided "finish your profile" flow. One open step at a time, in order, inside a single sheet:
 * the owner never has to leave and come back for the next one. The current step is *derived*
 * from the profile (first step not done), so it advances by itself the moment a
 * save lands -- including the logo, whose crop editor lives elsewhere.
 */
export function ProfileCompletionFlow({
  open,
  isSalon,
  steps,
  profile,
  logoEditing = false,
  onClose,
  onPickLogo,
  onQuickSave,
  onOpenServices
}) {
  const [saving, setSaving] = useState(false);

  // ProfileSheet re-binds its keyboard handling whenever `onClose` changes identity (and hands
  // focus back each time), so the handler given to it must stay the same across renders.
  const live = useRef({ onClose, logoEditing });
  live.current = { onClose, logoEditing };
  // While the logo crop editor is open on top, Escape / the back button belong to that editor only.
  const handleClose = useCallback(() => {
    if (!live.current.logoEditing) live.current.onClose();
  }, []);

  if (!open) return null;

  const current = steps.find((step) => !step.done);
  const allDone = steps.every((step) => step.done);
  const index = current ? steps.findIndex((step) => step.id === current.id) : steps.length;
  const Icon = current ? STEP_ICONS[current.id] : null;
  const copy = current ? STEP_COPY[current.id](isSalon) : null;

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

  return (
    <ProfileSheet open hideHeader hideClose label="تکمیل پروفایل" panelClassName="pcfSheet" onClose={handleClose}>
      <div className="pcfTop">
        <span className="pcfCount">
          {allDone ? "تموم شد!" : `قدم ${toPersianDigits(Math.min(index + 1, steps.length))} از ${toPersianDigits(steps.length)}`}
        </span>
        <button type="button" className="pcfClose" aria-label="بستن" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <ol className="pcfDots" aria-hidden="true">
        {steps.map((step, i) => (
          <li key={step.id} className={step.done ? "is-done" : !allDone && i === index ? "is-current" : ""} />
        ))}
      </ol>

      {allDone ? (
        <div className="pcfStep pcfFinale" key="finale">
          <span className="pcfFinaleBadge" aria-hidden="true"><Check size={40} /></span>
          <h3>صفحه‌ت آماده‌ست!</h3>
          <p>حالا مشتری‌ها راحت‌تر پیدات می‌کنن و با خیال راحت نوبت می‌گیرن.</p>
          <div className="pcfFooter">
            <Button block onClick={onClose}>ببینمش</Button>
          </div>
        </div>
      ) : current ? (
        <div className="pcfStep" key={current.id}>
          <header className="pcfHero">
            <span className="pcfHeroIcon" aria-hidden="true"><Icon size={26} /></span>
            <h3>{copy.title}</h3>
            <p>{copy.lead}</p>
          </header>

          <div className="pcfBody">
            {current.id === "avatar" ? (
              <label className="pcfPick">
                <span className="pcfPickDisc" aria-hidden="true"><ImagePlus size={34} /></span>
                <b>از گالری انتخاب کن</b>
                <small>اندازه و قابش رو بعدش تنظیم می‌کنی</small>
                <input className="captureInput" type="file" accept="image/*" onChange={onPickLogo} />
              </label>
            ) : null}

            {current.id === "area" ? (
              <MapPinPicker saving={saving} onSave={(fields) => save(fields, "جات روی نقشه ذخیره شد.")} />
            ) : null}

            {current.id === "specialty" ? (
              <SpecialtyMultiSelect
                inline
                options={beautySpecialtyOptions}
                defaultValue={profile?.data?.service || ""}
                disabled={saving}
                onDone={(selected) => save({ service: selected.join("، ") }, "کارهات ذخیره شد.")}
              />
            ) : null}

            {current.id === "services" ? (
              <Button block icon={ArrowLeft} onClick={openServices}>اولین خدمت رو بذار</Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ProfileSheet>
  );
}
