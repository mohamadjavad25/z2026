"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ImageCropper } from "../../components/ImageCropper";

// Frame ratios match where each image is really shown (logo: square tile,
// poster: the wide banner band), so the framing chosen here is the framing
// users see everywhere.
const FRAMES = {
  circle: { aspect: 1, outputWidth: 720, title: "تنظیم لوگو", shape: "circle" },
  wide: { aspect: 343 / 248, outputWidth: 1440, title: "تنظیم پوستر", shape: "rect" }
};

/**
 * Pan/zoom crop sheet for the logo and poster. Saving bakes the framed
 * region into a new image, so it is identical on every surface; the
 * object-position stays at center because the crop is already applied.
 */
export function ImagePositionEditor({ open, shape, image, busy = false, onSave, onClose }) {
  const cropperRef = useRef(null);
  const frame = FRAMES[shape] || FRAMES.wide;

  if (!open) return null;

  function handleSave() {
    const cropped = cropperRef.current?.exportCrop?.();
    if (!cropped) return;
    onSave("50% 50%", cropped);
  }

  return (
    <ProfileSheet
      open={open}
      kicker="تنظیم تصویر"
      title={frame.title}
      label="تنظیم تصویر"
      panelClassName="imagePositionSheet"
      onClose={onClose}
    >
      <ImageCropper
        key={image}
        ref={cropperRef}
        src={image}
        aspect={frame.aspect}
        shape={frame.shape}
        outputWidth={frame.outputWidth}
      />
      <div className="imagePositionActions">
        <button type="button" className="imagePositionReset" onClick={onClose} disabled={busy}>
          انصراف
        </button>
        <button type="button" className="imagePositionSave" disabled={busy} onClick={handleSave}>
          <Check size={14} aria-hidden="true" />
          {busy ? "..." : "ذخیره"}
        </button>
      </div>
    </ProfileSheet>
  );
}
