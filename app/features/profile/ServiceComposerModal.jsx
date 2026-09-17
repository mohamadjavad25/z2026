"use client";

import { Check, Timer } from "lucide-react";

/**
 * Shared artist + salon service create/edit modal.
 * Presentational: draft/mode + catalog + callbacks stay owned by HomeApp.
 */
export function ServiceComposerModal({
  open,
  mode = "preset",
  draft,
  catalog = [],
  existingServices = [],
  onClose,
  onModeChange,
  onDraftChange,
  onSubmitCustom,
  onPickPreset
}) {
  if (!open || !draft) return null;

  return (
    <div
      className="artistServiceModal"
      role="dialog"
      aria-modal="true"
      aria-label="افزودن خدمت"
      onClick={onClose}
    >
      <article className="artistServiceSheet" onClick={(event) => event.stopPropagation()}>
        <header className="artistServiceHead">
          <div>
            <h3>{draft.id ? "ویرایش خدمت" : "افزودن خدمت"}</h3>
          </div>
          <button type="button" className="artistServiceClose" onClick={onClose} aria-label="بستن">
            ×
          </button>
        </header>

        <div className="artistServiceModeSwitch" role="tablist" aria-label="روش افزودن خدمت">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preset"}
            className={mode === "preset" ? "active" : ""}
            disabled={Boolean(draft.id)}
            onClick={() => onModeChange?.("preset")}
          >
            خدمات آماده
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            className={mode === "custom" ? "active" : ""}
            onClick={() => onModeChange?.("custom")}
          >
            ایجاد خدمت
          </button>
        </div>

        {mode === "preset" ? (
          <div className="artistServicePresetList" role="list">
            {[...catalog]
              .sort((a, b) => {
                const aAdded = existingServices.some((item) => item.name === a.name);
                const bAdded = existingServices.some((item) => item.name === b.name);
                return Number(aAdded) - Number(bAdded);
              })
              .map((service) => {
                const alreadyAdded = existingServices.some((item) => item.name === service.name);
              return (
                <button
                  type="button"
                  key={service.id}
                  className={`artistServicePresetCard is-${service.tone || "soft"}${alreadyAdded ? " is-added" : ""}`}
                  disabled={alreadyAdded}
                  onClick={() => onPickPreset?.(service)}
                >
                  <span className="artistServicePresetBadge">{service.badge}</span>
                  <strong>{service.name}</strong>
                  <small>{service.hint}</small>
                  <span className="artistServicePresetMeta">
                    <em><Timer size={13} /> {service.duration}</em>
                    <b>{service.price}</b>
                  </span>
                  <i>{alreadyAdded ? "اضافه شده" : "افزودن"}</i>
                </button>
              );
            })}
          </div>
        ) : (
          <form className="artistServiceForm" onSubmit={onSubmitCustom}>
            <label className="artistServiceField">
              <span>نام خدمت</span>
              <input
                value={draft.name}
                onChange={(event) => onDraftChange?.({ name: event.target.value })}
                placeholder="مثلا شینیون کلاسیک"
                required
                autoFocus
              />
            </label>

            <div className="artistServiceRow">
              <label className="artistServiceField">
                <span>قیمت</span>
                <input
                  value={draft.price}
                  onChange={(event) => onDraftChange?.({ price: event.target.value })}
                  placeholder="از ۲.۴ م"
                  inputMode="text"
                />
              </label>
              <label className="artistServiceField">
                <span>مدت</span>
                <input
                  value={draft.duration}
                  onChange={(event) => onDraftChange?.({ duration: event.target.value })}
                  placeholder="۹۰ دقیقه"
                />
              </label>
            </div>

            <div className="artistServiceDurationRow" role="group" aria-label="انتخاب سریع مدت">
              {["۳۰ دقیقه", "۶۰ دقیقه", "۹۰ دقیقه", "۱۲۰ دقیقه"].map((option) => (
                <button
                  type="button"
                  key={option}
                  className={draft.duration === option ? "active" : ""}
                  onClick={() => onDraftChange?.({ duration: option })}
                >
                  {option.replace(" دقیقه", "′")}
                </button>
              ))}
            </div>

            <label className="artistServiceField">
              <span>توضیح کوتاه</span>
              <textarea
                value={draft.hint}
                onChange={(event) => onDraftChange?.({ hint: event.target.value })}
                placeholder="مثلا مناسب مراسم و مهمانی"
                rows={2}
              />
            </label>

            <button type="submit" className="artistServiceSubmit">
              <Check size={16} />
              {draft.id ? "ذخیره تغییرات" : "تایید و افزودن خدمت"}
            </button>
          </form>
        )}
      </article>
    </div>
  );
}
