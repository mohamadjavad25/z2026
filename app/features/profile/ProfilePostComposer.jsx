"use client";

import { useRef, useState } from "react";
import { Camera, Check, ChevronDown, Crop, ImagePlus, Trash2, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { ImageCropper } from "../../components/ImageCropper";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// 4:5 is the card ratio used in explore and the galleries, so the framing
// chosen here is exactly what every card shows.
const POST_ASPECT = 4 / 5;

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
  showFeaturedToggle = false,
  submitLabel = "ذخیره"
}) {
  const cropperRef = useRef(null);
  const [cropSrc, setCropSrc] = useState("");

  if (!value || typeof document === "undefined") return null;

  // Categories are exactly the services on the menu; no free typing.
  const tagChoices = Array.from(new Set(tagOptions.map((tag) => String(tag || "").trim()).filter(Boolean)));
  const canSubmit = Boolean(
    String(value.title || "").trim() &&
    String(value.tag || "").trim() &&
    String(value.image || "").trim()
  );
  const isNew = String(value.id).startsWith("new-") || value.id === "new";

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onNotify?.("فقط فایل تصویری مجاز است.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onNotify?.("حجم تصویر باید کمتر از ۸ مگابایت باشد.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function confirmCrop() {
    const cropped = cropperRef.current?.exportCrop?.();
    if (!cropped) return;
    patch({ image: cropped });
    setCropSrc("");
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
                  <button type="button" className="artistWorkCropCancel" onClick={() => setCropSrc("")}>
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
        <button type="button" className="artistWorkClose" onClick={onClose} aria-label="بستن" disabled={saving}>
          <X size={17} />
        </button>

        {cropSrc ? null : (
        <form className="artistWorkForm" onSubmit={onSubmit}>
          <div className="artistWorkRow">
            <label className="artistWorkField">
              <span>عنوان</span>
              <input
                value={value.title || ""}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="عنوان نمونه‌کار"
                required
                disabled={saving}
              />
            </label>
            <div className="artistWorkField artistWorkCategoryField">
              <span>دسته</span>
              <div className={`artistWorkTagSelect ${tagMenuOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="artistWorkTagTrigger"
                  aria-haspopup="listbox"
                  aria-expanded={tagMenuOpen}
                  onClick={() => onTagMenuOpenChange?.(!tagMenuOpen)}
                  disabled={saving || !tagChoices.length}
                >
                  <span className={value.tag ? "" : "is-placeholder"}>
                    {value.tag || (tagChoices.length ? "انتخاب خدمت" : "اول خدمت تعریف کن")}
                  </span>
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                {tagMenuOpen && (
                  <div className="artistWorkTagMenu" role="listbox" aria-label="انتخاب دسته">
                    {tagChoices.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        role="option"
                        aria-selected={value.tag === tag}
                        className={value.tag === tag ? "active" : ""}
                        onClick={() => {
                          patch({ tag });
                          onTagMenuOpenChange?.(false);
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {showCaption ? (
            <label className="artistWorkField">
              <span>توضیح</span>
              <textarea
                value={value.caption || ""}
                onChange={(event) => patch({ caption: event.target.value })}
                placeholder="توضیح کوتاه برای اکسپلور و گالری"
                rows={2}
                disabled={saving}
              />
            </label>
          ) : null}

          {showFeaturedToggle && (
            <div className="artistWorkSwitches">
              {showFeaturedToggle ? (
                <button
                  type="button"
                  className="artistWorkSwitch"
                  aria-pressed={Boolean(value.featured)}
                  disabled={saving}
                  onClick={() => patch({ featured: !value.featured })}
                >
                  <span>ویترین اصلی</span>
                  <small>اول گالری</small>
                  <b className={value.featured ? "is-on" : "is-off"}>
                    {value.featured ? "روشن" : "خاموش"}
                  </b>
                </button>
              ) : null}
            </div>
          )}

          {canSubmit && (
            <div className="artistWorkActions">
              <button type="submit" className="artistWorkSave" disabled={saving}>
                <Check size={16} /> {saving ? "در حال ذخیره..." : submitLabel}
              </button>
              {!isNew && typeof onDelete === "function" ? (
                <button type="button" className="artistWorkDelete" onClick={onDelete} disabled={saving}>
                  <Trash2 size={15} /> حذف
                </button>
              ) : null}
            </div>
          )}
        </form>
        )}
      </article>
    </div>,
    document.body
  );
}
