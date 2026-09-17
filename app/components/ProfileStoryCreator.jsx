"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Clapperboard, ImagePlus, Trash2, UploadCloud, X } from "lucide-react";

const PROFILE_LABELS = {
  salon: "سالن",
  shop: "فروشگاه",
  artist: "آرتیست"
};

/**
 * Shared story creation control for owner profiles (salon / shop / artist).
 * Renders the avatar story button + upload sheet; reuses the existing
 * salonStoryCreator* styles so no duplicate CSS is needed.
 */
// Matches the server's caps in app/api/profile/story/route.js (video 40MB /
// poster 3MB of base64 text) — checked on the raw file here, before reading
// it, so a huge video doesn't get encoded and previewed only to be rejected
// at save time.
const MAX_VIDEO_FILE_BYTES = 28 * 1024 * 1024;
const MAX_POSTER_FILE_BYTES = 2 * 1024 * 1024;

export function ProfileStoryCreator({
  profileType = "salon",
  storyVideo = "",
  storyPoster = "",
  onSave,
  onDelete,
  open = false,
  onOpenChange
}) {
  const [preview, setPreview] = useState("");
  const [posterPreview, setPosterPreview] = useState("");
  const [sizeError, setSizeError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const label = PROFILE_LABELS[profileType] || "پروفایل";
  const activePreview = preview || storyVideo;
  const activePoster = posterPreview || storyPoster || "/salon-public-hero.png";
  const hasSavedStory = Boolean(storyVideo || storyPoster);

  function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  async function handleVideoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      setSizeError("حجم ویدیو زیاده؛ یه ویدیوی کوتاه‌تر یا سبک‌تر انتخاب کن.");
      return;
    }
    setSizeError("");
    setPreview(await readFileAsDataUrl(file));
  }

  async function handlePosterUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_POSTER_FILE_BYTES) {
      setSizeError("حجم عکس زیاده؛ یه عکس سبک‌تر انتخاب کن.");
      return;
    }
    setSizeError("");
    setPosterPreview(await readFileAsDataUrl(file));
  }

  function saveStory() {
    if (activePreview || posterPreview) {
      onSave?.({ video: activePreview, poster: activePoster });
    }
    onOpenChange?.(false);
  }

  async function handleDelete() {
    if (!hasSavedStory || deleting) return;
    if (!window.confirm(`استوری ${label} حذف شود؟ این کار قابل بازگشت نیست.`)) return;
    setDeleting(true);
    try {
      await onDelete?.();
      setPreview("");
      setPosterPreview("");
      onOpenChange?.(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {open && typeof document !== "undefined" && createPortal((
        <div className="salonStoryCreatorOverlay" role="dialog" aria-modal="true" aria-label={`ساخت استوری معرفی ${label}`} onClick={(event) => { event.stopPropagation(); onOpenChange?.(false); }}>
          <article className="salonStoryCreatorSheet" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="salonStoryCreatorClose" onClick={() => onOpenChange?.(false)} aria-label="بستن">
              <X size={18} />
            </button>
            <div className="salonStoryCreatorHead">
              <span><Clapperboard size={17} /> استوری {label}</span>
              <h3>{activePreview ? "پیش‌نمایش ویدیو" : "ویدیو را انتخاب کن"}</h3>
            </div>
            <div className={`salonStoryCreatorPreview ${activePreview ? "has-video" : ""}`}>
              {activePreview ? (
                <video src={activePreview} poster={activePoster || undefined} controls playsInline muted />
              ) : (
                <div>
                  <Clapperboard size={32} />
                  <b>ویدیو انتخاب نشده</b>
                </div>
              )}
            </div>
            <div className="salonStoryCreatorUploads">
              <label className="salonStoryPosterControl">
                <img src={activePoster} alt="" aria-hidden="true" />
                <span><ImagePlus size={15} /> تعویض پوستر</span>
                <input type="file" accept="image/*" onChange={handlePosterUpload} />
              </label>
              <label className="salonStoryUploadControl">
                <UploadCloud size={18} />
                <span>{activePreview ? "تعویض ویدیو" : "انتخاب ویدیو"}</span>
                <input type="file" accept="video/*" onChange={handleVideoUpload} />
              </label>
            </div>
            {sizeError ? <p className="salonStoryCreatorError" role="alert">{sizeError}</p> : null}
            <div className="salonStoryCreatorActions">
              <button type="button" className="salonStoryPublishButton" onClick={saveStory} disabled={deleting}>
                {activePreview ? "ذخیره استوری" : "ذخیره پوستر"}
              </button>
              {hasSavedStory && (
                <button
                  type="button"
                  className="salonStoryDeleteButton"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 size={15} />
                  {deleting ? "در حال حذف…" : "حذف استوری"}
                </button>
              )}
            </div>
          </article>
        </div>
      ), document.body)}
    </>
  );
}
