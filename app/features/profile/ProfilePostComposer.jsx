"use client";

import { Camera, Check, ChevronDown, ImagePlus, Trash2, Upload } from "lucide-react";
import { createPortal } from "react-dom";

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
  onImageUpload,
  onImageClear,
  tagOptions = [],
  visibleTagOptions,
  tagMenuOpen = false,
  onTagMenuOpenChange,
  saving = false,
  ariaLabel = "ویرایش نمونه‌کار",
  showCaption = true,
  showExploreToggle = true,
  showFeaturedToggle = false,
  submitLabel = "ذخیره"
}) {
  if (!value || typeof document === "undefined") return null;

  const tags = Array.isArray(visibleTagOptions) ? visibleTagOptions : tagOptions;
  const canSubmit = Boolean(
    String(value.title || "").trim() &&
    String(value.tag || "").trim() &&
    String(value.image || "").trim()
  );
  const isNew = String(value.id).startsWith("new-") || value.id === "new";

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
        <div className={`artistWorkHero ${value.image ? "has-image" : ""}`}>
          {value.image ? (
            <>
              <img src={value.image} alt={value.title || "نمونه‌کار"} />
              <div className="artistWorkUploadOverlay">
                <span className="srOnly">تصویر آپلود‌شده</span>
                <div>
                  <label className="artistWorkUploadBtn" aria-label="تعویض تصویر" title="تعویض تصویر">
                    <ImagePlus size={15} />
                    <input
                      className="captureInput"
                      type="file"
                      accept="image/*"
                      onChange={onImageUpload}
                      disabled={saving}
                    />
                  </label>
                  <button type="button" onClick={onImageClear} disabled={saving} aria-label="حذف تصویر" title="حذف تصویر">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="artistWorkUploadEmpty">
              <Upload size={28} />
              <b>تصویر نمونه‌کار را آپلود کن</b>
              <span>عکس واضح از کار، بهترین نتیجه در گالری و اکسپلور می‌دهد.</span>
              <div className="artistWorkUploadActions">
                <label>
                  <Camera size={16} />
                  دوربین
                  <input
                    className="captureInput"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onImageUpload}
                    disabled={saving}
                  />
                </label>
                <label>
                  <ImagePlus size={16} />
                  گالری
                  <input
                    className="captureInput"
                    type="file"
                    accept="image/*"
                    onChange={onImageUpload}
                    disabled={saving}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        <button type="button" className="artistWorkClose" onClick={onClose} aria-label="بستن" disabled={saving}>
          ×
        </button>

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
                <div className="artistWorkTagTrigger">
                  <input
                    value={value.tag || ""}
                    onChange={(event) => {
                      patch({ tag: event.target.value });
                      onTagMenuOpenChange?.(true);
                    }}
                    onFocus={() => onTagMenuOpenChange?.(true)}
                    placeholder="دسته را بنویس"
                    aria-haspopup="listbox"
                    aria-expanded={tagMenuOpen}
                    disabled={saving}
                  />
                  <button
                    type="button"
                    aria-label="نمایش دسته‌ها"
                    onClick={() => onTagMenuOpenChange?.(!tagMenuOpen)}
                    disabled={saving}
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                </div>
                {tagMenuOpen && (
                  <div className="artistWorkTagMenu" role="listbox" aria-label="انتخاب دسته">
                    {tags.map((tag) => (
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
                    {value.tag && !tagOptions.includes(value.tag) && (
                      <button
                        type="button"
                        role="option"
                        aria-selected="true"
                        className="active"
                        onClick={() => onTagMenuOpenChange?.(false)}
                      >
                        {String(value.tag).trim()}
                      </button>
                    )}
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

          {(showExploreToggle || showFeaturedToggle) && (
            <div className="artistWorkSwitches">
              {showExploreToggle ? (
                <button
                  type="button"
                  className="artistWorkSwitch"
                  aria-pressed={Boolean(value.inExplore)}
                  disabled={saving}
                  onClick={() => patch({ inExplore: !value.inExplore })}
                >
                  <span>نمایش در اکسپلور</span>
                  <small>در فید اکسپلور</small>
                  <b className={value.inExplore ? "is-on" : "is-off"}>
                    {value.inExplore ? "روشن" : "خاموش"}
                  </b>
                </button>
              ) : null}
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
      </article>
    </div>,
    document.body
  );
}
