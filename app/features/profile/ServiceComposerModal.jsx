"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, Timer } from "lucide-react";
import { ServiceEmoji } from "../../components/ServiceEmoji";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceEmojiPicker } from "../../components/ServiceEmojiPicker";
import { EMOJI_CATEGORIES } from "../../shared/constants/beautyEmoji";
import { categoriesForSpecialties } from "../../shared/constants/serviceCatalog";
import { toPersianDigits } from "../../shared/lib/digits";
import { SheetClose } from "../../components/SheetClose";

const DURATION_CHIPS = ["۱۵ دقیقه", "۳۰ دقیقه", "۴۵ دقیقه", "۶۰ دقیقه", "۹۰ دقیقه", "۱۲۰ دقیقه", "۱۸۰ دقیقه"];

/**
 * Shared artist + salon service create/edit modal.
 *
 * Two tabs: a searchable catalog of ready-made services (tap one to open it
 * pre-filled in the editor, or hit + to add it as-is) and the editor itself,
 * where the owner can change the name, icon, price, duration and description.
 * Presentational: draft/mode + callbacks stay owned by HomeApp / the hook.
 */
export function ServiceComposerModal({
  open,
  mode = "preset",
  draft,
  catalog = [],
  existingServices = [],
  specialties = "",
  onClose,
  onModeChange,
  onDraftChange,
  onSubmitCustom,
  onPickPreset,
  onCustomizePreset
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("mine");

  const mine = useMemo(() => categoriesForSpecialties(specialties), [specialties]);
  // Categories shown as chips: the owner's own fields first, then the rest.
  const orderedCategories = useMemo(() => {
    const first = EMOJI_CATEGORIES.filter((item) => mine.includes(item.id));
    const rest = EMOJI_CATEGORIES.filter((item) => !mine.includes(item.id));
    return [...first, ...rest];
  }, [mine]);
  const activeCategory = category === "mine" && !mine.length ? "all" : category;

  const addedNames = useMemo(() => new Set(existingServices.map((item) => item.name)), [existingServices]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const wanted = activeCategory === "mine" ? mine : activeCategory === "all" ? null : [activeCategory];
    return catalog
      .filter((item) => (!wanted || wanted.includes(item.category))
        && (!q || `${item.name} ${item.hint} ${item.badge}`.toLowerCase().includes(q)))
      .sort((a, b) => Number(addedNames.has(a.name)) - Number(addedNames.has(b.name)));
  }, [catalog, activeCategory, mine, query, addedNames]);

  // Smart suggestions: while a new service is being named, offer matching
  // catalog entries that fill price, duration, description and icon in one tap.
  const suggestions = useMemo(() => {
    const q = String(draft?.name || "").trim().toLowerCase();
    if (draft?.id || q.length < 2) return [];
    return catalog
      .filter((item) => !addedNames.has(item.name)
        && item.name.toLowerCase() !== q
        && `${item.name} ${item.badge}`.toLowerCase().includes(q))
      .slice(0, 3);
  }, [catalog, addedNames, draft?.id, draft?.name]);

  if (!open || !draft) return null;

  const editing = Boolean(draft.id);
  const hasName = Boolean(draft.name.trim());
  const addedCount = addedNames.size;

  return (
    <div
      className="svcSheetBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "ویرایش خدمت" : "افزودن خدمت"}
      onClick={onClose}
    >
      <article className="svcSheet" onClick={(event) => event.stopPropagation()}>
        <header className="svcSheetHead">
          <div>
            <span>
              {!editing && addedCount
                ? `${toPersianDigits(addedCount)} خدمت در منوی تو`
                : "خدمات"}
            </span>
            <h3>{editing ? "ویرایش خدمت" : "افزودن خدمت"}</h3>
          </div>
        </header>

        <div className="svcModeSwitch" role="tablist" aria-label="روش افزودن خدمت">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preset"}
            className={mode === "preset" ? "on" : ""}
            disabled={editing}
            onClick={() => onModeChange?.("preset")}
          >
            <ServiceEmoji id="sparkles" size={20} />
            کاتالوگ خدمات
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            className={mode === "custom" ? "on" : ""}
            onClick={() => onModeChange?.("custom")}
          >
            <ServiceEmoji id="makeup_lesson" size={20} />
            {editing ? "ویرایش" : "ساخت خدمت"}
          </button>
        </div>

        {mode === "preset" ? (
          <div className="svcCatalog">
            <label className="svcSearch">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جستجوی خدمت… (مثلاً ژلیش، لیزر، شینیون)"
                aria-label="جستجوی خدمت"
              />
            </label>
            <div className="svcTabs" role="tablist" aria-label="دسته‌بندی خدمات">
              {mine.length ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === "mine"}
                  className={activeCategory === "mine" ? "on" : ""}
                  onClick={() => setCategory("mine")}
                >
                  <ServiceEmoji id="heart" size={20} />
                  تخصص من
                </button>
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === "all"}
                className={activeCategory === "all" ? "on" : ""}
                onClick={() => setCategory("all")}
              >
                <ServiceEmoji id="sparkles" size={20} />
                همه
              </button>
              {orderedCategories.map((item) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === item.id}
                  className={activeCategory === item.id ? "on" : ""}
                  key={item.id}
                  onClick={() => setCategory(item.id)}
                >
                  <ServiceEmoji id={item.icon} size={20} />
                  {item.fa}
                </button>
              ))}
            </div>

            <p className="svcCatalogHint">
              روی خدمت بزن تا نام و قیمتش را ویرایش کنی، یا با + سریع اضافه‌اش کن. می‌توانی چند خدمت پشت‌سرهم انتخاب کنی.
            </p>

            <div className="svcPresetGrid" role="list">
              {visible.length === 0 ? (
                <div className="svcEmptyState" role="status">
                  <ServiceIcon emoji="mirror" size="xl" />
                  <b>خدمتی پیدا نشد</b>
                  <span>می‌توانی خدمت دلخواهت را خودت بسازی.</span>
                  <button type="button" onClick={() => onModeChange?.("custom")}>
                    <Plus size={15} />
                    ساخت خدمت جدید
                  </button>
                </div>
              ) : null}
              {visible.map((service) => {
                const added = addedNames.has(service.name);
                return (
                  <div className={`svcPreset${added ? " is-added" : ""}`} role="listitem" key={service.id}>
                    <button
                      type="button"
                      className="svcPresetMain"
                      disabled={added}
                      onClick={() => onCustomizePreset?.(service)}
                      aria-label={`${service.name}، ${service.price}، ${service.duration}`}
                    >
                      <ServiceIcon emoji={service.emoji} name={service.name} size="lg" />
                      <strong>{service.name}</strong>
                      <small>{service.hint}</small>
                      <span className="svcPresetMeta">
                        <em><Timer size={12} /> {toPersianDigits(service.duration)}</em>
                        <b>{service.price}</b>
                      </span>
                    </button>
                    {added ? (
                      <span className="svcPresetDone"><Check size={14} /> اضافه شده</span>
                    ) : (
                      <button
                        type="button"
                        className="svcPresetQuick"
                        aria-label={`افزودن سریع ${service.name}`}
                        title="افزودن سریع"
                        onClick={() => onPickPreset?.(service)}
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="svcDoneBar">
              <button type="button" className="svcSubmit svcDone" onClick={onClose}>
                <Check size={17} />
                {addedCount ? `تمام (${toPersianDigits(addedCount)} خدمت)` : "بستن"}
              </button>
            </div>
          </div>
        ) : (
          <form className="svcForm" onSubmit={onSubmitCustom}>
            <div className="svcFormHero">
              <button
                type="button"
                className="svcIconSlot"
                aria-label="انتخاب آیکن خدمت"
                onClick={() => setPickerOpen(true)}
              >
                {draft.emoji || draft.name.trim() ? (
                  <ServiceIcon emoji={draft.emoji} name={draft.name} size="xl" />
                ) : (
                  <span className="svcIconSlotEmpty"><Plus size={26} /></span>
                )}
                <small>{draft.emoji ? "تغییر آیکن" : "انتخاب آیکن"}</small>
              </button>
              <label className="svcField">
                <span>نام خدمت</span>
                <input
                  value={draft.name}
                  onChange={(event) => onDraftChange?.({ name: event.target.value })}
                  placeholder="مثلاً شینیون کلاسیک"
                  required
                  autoFocus
                />
              </label>
            </div>

            {suggestions.length ? (
              <div className="svcSuggest" role="group" aria-label="پیشنهاد از کاتالوگ">
                <small>پیشنهاد؛ با یک ضربه قیمت و مدت پر می‌شود:</small>
                <div>
                  {suggestions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => onDraftChange?.({
                        name: item.name,
                        price: item.price,
                        duration: item.duration,
                        hint: item.hint,
                        emoji: item.emoji || "",
                        badge: item.badge || ""
                      })}
                    >
                      <ServiceIcon emoji={item.emoji} name={item.name} size="sm" />
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="svcFieldRow">
              <label className="svcField">
                <span>قیمت (تومان)</span>
                <input
                  value={draft.price}
                  onChange={(event) => onDraftChange?.({ price: event.target.value })}
                  placeholder="از ۲.۴ م"
                  inputMode="text"
                />
              </label>
              <label className="svcField">
                <span>مدت</span>
                <input
                  value={draft.duration}
                  onChange={(event) => onDraftChange?.({ duration: event.target.value })}
                  placeholder="۹۰ دقیقه"
                />
              </label>
            </div>

            <div className="svcChips" role="group" aria-label="انتخاب سریع مدت">
              {DURATION_CHIPS.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={draft.duration === option ? "on" : ""}
                  onClick={() => onDraftChange?.({ duration: option })}
                >
                  {option.replace(" دقیقه", "′")}
                </button>
              ))}
            </div>

            <label className="svcField">
              <span>توضیح کوتاه</span>
              <textarea
                value={draft.hint}
                onChange={(event) => onDraftChange?.({ hint: event.target.value })}
                placeholder="مثلاً مناسب مراسم و مهمانی"
                rows={2}
              />
            </label>

            {!draft.price.trim() ? (
              <p className="svcFormNote">قیمت را خالی بگذاری، «توافقی» نمایش داده می‌شود.</p>
            ) : null}

            <button type="submit" className="svcSubmit" disabled={!hasName}>
              <Check size={17} />
              {editing ? "ذخیره تغییرات" : "افزودن به خدمات من"}
            </button>
          </form>
        )}
  <SheetClose onClick={onClose} />
      </article>
      <ServiceEmojiPicker
        open={pickerOpen}
        value={draft.emoji || ""}
        onClose={() => setPickerOpen(false)}
        onPick={(id) => {
          onDraftChange?.({ emoji: id });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
