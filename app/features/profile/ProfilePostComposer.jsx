"use client";

import { Spinner } from "../../components/Spinner";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronDown, Crop, Globe, ImagePlus, Lock, Pin, Trash2, Upload } from "lucide-react";
import { createPortal } from "react-dom";
import { ImageCropper } from "../../components/ImageCropper";
import { SheetClose } from "../../components/SheetClose";

// A photo this small and no bigger than MAX_SOURCE_SIDE goes to the crop step untouched.
const SMALL_ENOUGH_BYTES = 4 * 1024 * 1024;
// 4:5 is the card ratio used in the galleries, so the framing
// chosen here is exactly what every card shows.
const POST_ASPECT = 4 / 5;
// Phone photos can be huge; the crop step never needs more than this on its long side.
const MAX_SOURCE_SIDE = 2400;

// The gallery tile picks the photo before the composer exists. The file is parked here (not in
// React state) so it survives however the gallery re-renders while the sheet opens.
let queuedFile = null;
let queuedAt = 0;
export function queuePostFile(file) {
  queuedFile = file || null;
  queuedAt = Date.now();
}
function peekQueuedPostFile() {
  return queuedFile && Date.now() - queuedAt < 10000 ? queuedFile : null;
}
function takeQueuedPostFile() {
  const file = peekQueuedPostFile();
  queuedFile = null;
  return file;
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
}

// Decodes the photo however this browser can: with its EXIF rotation, plain, or through an <img>
// (older Android WebViews reject the rotation option, and some fail on very big bitmaps).
async function decodePhoto(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch { /* try the next way */ }
    try {
      return await createImageBitmap(file);
    } catch { /* try the next way */ }
  }
  return loadImage(await readAsDataUrl(file));
}

// Shrinks any photo (however many megabytes) before cropping; a photo is refused only when it
// cannot be opened at all.
async function prepareSource(file) {
  const image = await decodePhoto(file);
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  if (!width || !height) throw new Error("decode");
  const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(width, height));
  if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES) {
    image.close?.();
    return readAsDataUrl(file);
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // a transparent PNG would turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Shared post / portfolio composer (artist + salon).
 * Same modal sheet used from ProfileGallery.
 * Portaled to document.body so sticky rails cannot cover it.
 */
export function ProfilePostComposer({
  value,
  onChange,
  onClose,
  onSubmit,
  onDelete,
  onNotify,
  onImageClear,
  tagOptions = [],
  tagMenuOpen = false,
  onTagMenuOpenChange,
  saving = false,
  ariaLabel = "ویرایش نمونه‌کار",
  showCaption = true,
  showVisibility = true,
  showPin = true,
  pinnedCount = 0,
  pinLimit = 3,
  submitLabel = "ذخیره"
}) {
  const cropperRef = useRef(null);
  const [cropSrc, setCropSrc] = useState("");
  const isOpen = Boolean(value);

  // Starts true when a picked photo is waiting, so the sheet never flashes the upload form first.
  const [preparing, setPreparing] = useState(() => Boolean(peekQueuedPostFile()));
  // True when the photo was picked before the sheet opened: backing out of the crop then closes
  // the sheet instead of leaving an empty "upload a photo" form.
  const startedFromPicker = useRef(false);

  async function acceptFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onNotify?.("فقط عکس می‌شه.");
      if (startedFromPicker.current) onClose?.();
      return;
    }
    setPreparing(true);
    try {
      setCropSrc(await prepareSource(file));
    } catch {
      onNotify?.("این عکس باز نشد؛ یه عکس دیگه انتخاب کن.");
      if (startedFromPicker.current) onClose?.();
    } finally {
      setPreparing(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const file = takeQueuedPostFile();
    if (!file) return;
    startedFromPicker.current = true;
    acceptFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [isOpen]);

  // Escape closes the composer (or just the crop step), never mid-save.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape" || saving) return;
      if (cropSrc) {
        setCropSrc("");
        if (startedFromPicker.current && !value?.image) onClose?.();
      } else onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, saving, cropSrc, onClose]);

  // While the sheet is open, the page behind it must not scroll: a swipe should move the form.
  useEffect(() => {
    if (!isOpen) return undefined;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [isOpen]);

  // Only one service on the menu: pick it (and name the post after it) right away.
  const onlyChoice = tagOptions.length === 1 ? String(tagOptions[0] || "").trim() : "";
  const needsAutoPick = isOpen && Boolean(onlyChoice) && !String(value?.tag || "").trim();
  useEffect(() => {
    if (!needsAutoPick) return;
    onChange?.((prev) => (prev && !String(prev.tag || "").trim()
      ? { ...prev, tag: onlyChoice, title: String(prev.title || "").trim() ? prev.title : onlyChoice }
      : prev));
  }, [needsAutoPick, onlyChoice, onChange]);

  if (!value || typeof document === "undefined") return null;

  // Categories are exactly the services on the menu; no free typing.
  const tagChoices = Array.from(new Set(tagOptions.map((tag) => String(tag || "").trim()).filter(Boolean)));
  const missing = [
    !String(value.image || "").trim() ? "تصویر" : "",
    !String(value.title || "").trim() ? "عنوان" : "",
    // A category can only be asked for when the menu has services to pick from; with an empty
    // menu the post goes out without one instead of leaving the button stuck.
    tagChoices.length && !String(value.tag || "").trim() ? "دسته" : ""
  ].filter(Boolean);
  const canSubmit = missing.length === 0;
  const isPrivate = value.isPublic === false;
  const pinDisabled = !value.featured && pinnedCount >= pinLimit;
  const isNew = String(value.id).startsWith("new-") || value.id === "new";

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    acceptFile(file);
  }

  function confirmCrop() {
    const cropped = cropperRef.current?.exportCrop?.();
    if (!cropped) return;
    patch({ image: cropped });
    setCropSrc("");
    startedFromPicker.current = false;
  }

  function patch(next) {
    onChange?.((prev) => (prev ? { ...prev, ...next } : prev));
  }

  return createPortal(
    <div
      className="artistWorkModal profilePostComposer"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <article className="artistWorkSheet" onClick={(event) => event.stopPropagation()}>
        {cropSrc || value.image ? (
          <div className="artistWorkCropStage">
            {cropSrc ? (
              <>
                <ImageCropper
                  key={cropSrc}
                  ref={cropperRef}
                  src={cropSrc}
                  aspect={POST_ASPECT}
                  outputWidth={1080}
                />
                <div className="artistWorkCropActions">
                  <button
                    type="button"
                    className="artistWorkCropCancel"
                    onClick={() => {
                      setCropSrc("");
                      if (startedFromPicker.current && !value.image) onClose?.();
                    }}
                  >
                    انصراف
                  </button>
                  <button type="button" className="artistWorkCropConfirm" onClick={confirmCrop}>
                    <Check size={15} /> همین خوبه
                  </button>
                </div>
              </>
            ) : (
              <div className="artistWorkHero has-image">
                <img src={value.image} alt={value.title || "نمونه‌کار"} />
                <div className="artistWorkUploadOverlay">
                  <span className="srOnly">تصویر پست</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => setCropSrc(value.image)}
                      disabled={saving}
                      aria-label="تنظیم کادر تصویر"
                      title="تنظیم کادر تصویر"
                    >
                      <Crop size={15} />
                    </button>
                    <label className="artistWorkUploadBtn" title="تعویض تصویر">
                      <ImagePlus size={15} />
                      <span className="srOnly">تعویض تصویر</span>
                      <input className="captureInput" type="file" accept="image/*" onChange={handleFile} disabled={saving} />
                    </label>
                    <button type="button" onClick={onImageClear} disabled={saving} aria-label="حذف تصویر" title="حذف تصویر">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : preparing ? (
          <div className="artistWorkHero">
            <div className="artistWorkUploadEmpty" role="status">
              <b>دارم عکس رو آماده می‌کنم…</b>
            </div>
          </div>
        ) : (
          <div className="artistWorkHero">
            <div className="artistWorkUploadEmpty">
              <Upload size={28} />
              <b>عکس کارت رو بذار</b>
              <span>انتخابش که کردی، قابش رو جابه‌جا و بزرگ‌کوچیک می‌کنی.</span>
              <div className="artistWorkUploadActions">
                <label>
                  <Camera size={16} />
                  دوربین
                  <input className="captureInput" type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={saving} />
                </label>
                <label>
                  <ImagePlus size={16} />
                  گالری
                  <input className="captureInput" type="file" accept="image/*" onChange={handleFile} disabled={saving} />
                </label>
              </div>
            </div>
          </div>
        )}
        {cropSrc ? null : (
        <form className="artistWorkForm" onSubmit={onSubmit}>
          <div className="artistWorkField artistWorkCategoryField">
            <span>این کار مال کدوم خدمته؟</span>
            {tagChoices.length ? (
              <div className="pcTags" role="radiogroup" aria-label="انتخاب خدمت">
                {tagChoices.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    role="radio"
                    aria-checked={value.tag === tag}
                    className={value.tag === tag ? "is-on" : ""}
                    disabled={saving}
                    // The title follows the service while it is blank or still just a service
                    // name; a title the user typed stays as it is.
                    onClick={() => {
                      const title = String(value.title || "").trim();
                      patch(!title || tagChoices.includes(title) ? { tag, title: tag } : { tag });
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : (
              <small className="pcHint">هنوز خدمتی توی منوت نیست؛ بدون دسته می‌ره. بعداً می‌تونی به یه خدمت وصلش کنی.</small>
            )}
          </div>

          <div className="artistWorkRow">
            <label className="artistWorkField">
              <span>عنوان</span>
              <input
                value={value.title || ""}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="عنوان نمونه‌کار"
                maxLength={80}
                required
                disabled={saving}
              />
            </label>
          </div>

          {showCaption ? (
            <label className="artistWorkField">
              <span>توضیح</span>
              <textarea
                value={value.caption || ""}
                onChange={(event) => patch({ caption: event.target.value })}
                placeholder="یه توضیح کوتاه دربارهٔ این کار"
                rows={3}
                maxLength={600}
                disabled={saving}
              />
            </label>
          ) : null}

          {showVisibility ? (
            <div className="artistWorkField">
              <span>کی ببینه؟</span>
              <div className="pcVisibility" role="radiogroup" aria-label="نمایش پست">
                <button type="button" role="radio" aria-checked={!isPrivate} className={!isPrivate ? "is-on" : ""} disabled={saving} onClick={() => patch({ isPublic: true })}>
                  <Globe size={15} /> همه
                </button>
                <button type="button" role="radio" aria-checked={isPrivate} className={isPrivate ? "is-on" : ""} disabled={saving} onClick={() => patch({ isPublic: false })}>
                  <Lock size={15} /> فقط من
                </button>
              </div>
              <small className="pcHint">{isPrivate ? "توی صفحه‌ت و جستجو دیده نمی‌شه." : "توی صفحه‌ت دیده می‌شه."}</small>
            </div>
          ) : null}

          {showPin ? (
            <button
              type="button"
              className={`pcPin ${value.featured ? "is-on" : ""}`}
              aria-pressed={Boolean(value.featured)}
              disabled={saving || pinDisabled}
              onClick={() => patch({ featured: !value.featured })}
            >
              <Pin size={16} />
              <span>
                <b>سنجاقش کن اول ویترین</b>
                <small>{pinDisabled ? `حداکثر ${pinLimit} تا کار رو می‌تونی سنجاق کنی.` : "کارهای سنجاق‌شده همیشه اول دیده می‌شن."}</small>
              </span>
              <i>{value.featured ? "روشن" : "خاموش"}</i>
            </button>
          ) : null}

          <div className="artistWorkActions">
            <button type="submit" className="artistWorkSave" disabled={saving || !canSubmit}>
              <Check size={16} /> {saving ? "دارم ذخیره می‌کنم…" : submitLabel}
            </button>
            {!isNew && typeof onDelete === "function" ? (
              <button type="button" className="artistWorkDelete" onClick={onDelete} disabled={saving}>
                <Trash2 size={15} /> حذف
              </button>
            ) : null}
          </div>
          {!canSubmit ? <p className="pcMissing" role="status">برای ذخیره اینا لازمه: {missing.join("، ")}</p> : null}
        </form>
        )}
        <SheetClose onClick={onClose} disabled={saving} />
        {saving ? (
          <div className="sheetBusy" role="status" aria-live="polite">
            <Spinner size={38} />
            <b>{isNew ? "دارم نمونه‌کار رو می‌ذارم…" : "دارم ذخیره می‌کنم…"}</b>
          </div>
        ) : null}
      </article>
    </div>,
    document.body
  );
}
