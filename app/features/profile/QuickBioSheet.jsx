"use client";

import { useState } from "react";
import { ProfileSheet } from "./ProfileSheet";

const MAX = 600;

/**
 * One-field «درباره» editor for the profile checklist: write a few lines and
 * they are saved straight away, no need to open the whole edit form.
 */
export function QuickBioSheet({ open, isSalon = false, initial = "", onClose, onSave }) {
  const [text, setText] = useState(initial);
  const trimmed = text.trim();
  return (
    <ProfileSheet open={open} kicker="یک قدم تا تکمیل" title={isSalon ? "درباره سالن" : "درباره من"} panelClassName="quickBioSheet" onClose={onClose}>
      <p className="quickBioHint">
        {isSalon
          ? "از سابقه، سبک کار و چیزی که سالن را خاص می‌کند بنویس؛ مشتری قبل از رزرو همین را می‌خواند."
          : "از تخصص، سابقه و سبک کارت بنویس؛ مشتری قبل از رزرو همین را می‌خواند."}
      </p>
      <textarea
        className="quickBioInput"
        value={text}
        maxLength={MAX}
        rows={6}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        aria-label={isSalon ? "درباره سالن" : "درباره من"}
        placeholder={isSalon ? "مثلاً: سالن ما از ۱۳۹۸ با تیمی حرفه‌ای در خدمت شماست…" : "مثلاً: ۶ سال سابقه در رنگ و مش. عاشق کار تمیز و نتیجه‌ای هستم که خودت دوست داشته باشی…"}
      />
      <button type="button" className="quickBioSave" disabled={trimmed.length < 10} onClick={() => onSave?.(trimmed)}>
        ذخیره
      </button>
    </ProfileSheet>
  );
}
