"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronDown, Crop, Globe, ImagePlus, Lock, Pin, Trash2, Upload } from "lucide-react";
import { createPortal } from "react-dom";
import { ImageCropper } from "../../components/ImageCropper";
import { SheetClose } from "../../components/SheetClose";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
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

// Shrinks a big photo (and applies its EXIF rotation) before cropping; falls back to the raw file.
async function prepareSource(file) {
  try {
    if (typeof createImageBitmap !== "function") return await readAsDataUrl(file);
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= MAX_IMAGE_BYTES) {
      bitmap.close?.();
      return await readAsDataUrl(file);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    if (file.size > MAX_IMAGE_BYTES) throw new Error("too-big");
    return readAsDataUrl(file);
  }
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
      onNotify?.("فقط فایل تصویری مجاز است.");
      if (startedFromPicker.current) onClose?.();
      return;
    }
    setPreparing(true);
    try {
      setCropSrc(await prepareSource(file));
    } catch {
      onNotify?.("حجم تصویر باید کمتر از ۸ مگابایت باشد.");
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
                    <Check size={15} /> تایید کادر
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
                    <label className="artistWorkUploadBtn" aria-label="تعویض تصویر" title="تعویض تصویر">
                      <ImagePlus size={15} />
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
              <b>در حال آماده‌سازی عکس…</b>
            </div>
          </div>
        ) : (
          <div className="artistWorkHero">
            <div className="artistWorkUploadEmpty">
              <Upload size={28} />
              <b>تصویر نمونه‌کار را آپلود کن</b>
              <span>بعد از انتخاب، کادر عکس را جابه‌جا و بزرگ‌کوچک می‌کنی.</span>
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
            <span>این کار مربوط به کدام خدمت است؟</span>
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
              <small className="pcHint">هنوز خدمتی در منوی تو نیست؛ پست بدون دسته منتشر می‌شود. بعداً می‌توانی آن را به یک خدمت وصل کنی.</small>
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
                placeholder="توضیح کوتاه دربارهٔ این کار"
                rows={3}
                maxLength={600}
                disabled={saving}
              />
            </label>
          ) : null}

          {showVisibility ? (
            <div className="artistWorkField">
              <span>چه کسی ببیند؟</span>
              <div className="pcVisibility" role="radiogroup" aria-label="نمایش پست">
                <button type="button" role="radio" aria-checked={!isPrivate} className={!isPrivate ? "is-on" : ""} disabled={saving} onClick={() => patch({ isPublic: true })}>
                  <Globe size={15} /> همه
                </button>
                <button type="button" role="radio" aria-checked={isPrivate} className={isPrivate ? "is-on" : ""} disabled={saving} onClick={() => patch({ isPublic: false })}>
                  <Lock size={15} /> فقط من
                </button>
              </div>
              <small className="pcHint">{isPrivate ? "این کار در پروفایل عمومی و جست‌وجو دیده نمی‌شود." : "این کار در پروفایل عمومی تو نمایش داده می‌شود."}</small>
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
                <b>سنجاق به ابتدای گالری</b>
                <small>{pinDisabled ? `حداکثر ${pinLimit} کار را می‌توانی سنجاق کنی.` : "کارهای سنجاق‌شده همیشه اول دیده می‌شوند."}</small>
              </span>
              <i>{value.featured ? "روشن" : "خاموش"}</i>
            </button>
          ) : null}

          <div className="artistWorkActions">
            <button type="submit" className="artistWorkSave" disabled={saving || !canSubmit}>
              <Check size={16} /> {saving ? "در حال ذخیره..." : submitLabel}
            </button>
            {!isNew && typeof onDelete === "function" ? (
              <button type="button" className="artistWorkDelete" onClick={onDelete} disabled={saving}>
                <Trash2 size={15} /> حذف
              </button>
            ) : null}
          </div>
          {!canSubmit ? <p className="pcMissing" role="status">برای ذخیره لازم است: {missing.join("، ")}</p> : null}
        </form>
        )}
        <SheetClose onClick={onClose} disabled={saving} />
        {saving ? (
          <div className="sheetBusy" role="status" aria-live="polite">
            <span className="sheetBusySpinner" aria-hidden="true" />
            <b>{isNew ? "در حال انتشار نمونه‌کار…" : "در حال ذخیره تغییرات…"}</b>
          </div>
        ) : null}
      </article>
    </div>,
    document.body
  );
}
