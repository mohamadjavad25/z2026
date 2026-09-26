"use client";

/**
 * Shared collaboration-terms presets/chip-row — used by both directions of
 * the collab flow: an artist proposing terms to a salon (ArtistCollabBoard)
 * and a salon setting terms while inviting an artist (SalonNearbyInviteSheet).
 * Kept as tap-only chips (no free-typing) on the salon side specifically
 * because that form is meant to stay light and simple.
 */
export const DAY_PRESETS = [
  { label: "شنبه تا چهارشنبه", value: "شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه" },
  { label: "آخر هفته", value: "پنجشنبه، جمعه" },
  { label: "هر روز", value: "شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه، پنجشنبه، جمعه" }
];

export const NEGOTIABLE = "توافقی";

export const SHARE_PRESETS = [
  ...["۳۰", "۴۰", "۵۰", "۶۰"].map((value) => ({ label: `${value}٪`, value })),
  { label: NEGOTIABLE, value: NEGOTIABLE }
];

export const CAPACITY_PRESETS = [
  ...["۲", "۴", "۶", "۸"].map((value) => ({ label: value, value })),
  { label: NEGOTIABLE, value: NEGOTIABLE }
];

export const HOUR_RANGE_PRESETS = [
  { label: "۹ تا ۱۸", from: "۰۹:۰۰", to: "۱۸:۰۰" },
  { label: "۱۰ تا ۲۰", from: "۱۰:۰۰", to: "۲۰:۰۰" },
  { label: "۱۲ تا ۲۱", from: "۱۲:۰۰", to: "۲۱:۰۰" }
];

export function PresetRow({ options, isSelected, onPick }) {
  return (
    <div className="collabPresetRow">
      {options.map((option) => (
        <button
          type="button"
          key={option.label}
          className={`collabPresetChip ${isSelected(option.value) ? "is-selected" : ""}`}
          onClick={() => onPick(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
