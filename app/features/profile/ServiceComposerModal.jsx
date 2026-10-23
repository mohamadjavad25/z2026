"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Plus, Search, Timer, Trash2 } from "lucide-react";
import { ServiceEmoji } from "../../components/ServiceEmoji";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceEmojiPicker } from "../../components/ServiceEmojiPicker";
import { EMOJI_CATEGORIES } from "../../shared/constants/beautyEmoji";
import { categoriesForSpecialties } from "../../shared/constants/serviceCatalog";
import { toPersianDigits } from "../../shared/lib/digits";
import { useBackHandler } from "../../shared/hooks/useBackHandler";

// The catalog is shown a page at a time: ~30 gradient SVG icons in one scroll box exhausted tile memory
// on some Android phones and left static/clipped bands (see docs/DEVLOG.md), so only a few are mounted.
const CATALOG_PAGE = 8;

const DURATION_CHIPS = ["۱۵ دقیقه", "۳۰ دقیقه", "۴۵ دقیقه", "۶۰ دقیقه", "۹۰ دقیقه", "۱۲۰ دقیقه", "۱۸۰ دقیقه"];

/**
 * Shared artist + salon service create/edit page.
 *
 * An ordinary page, not an overlay: it is rendered into <body>, the app under it is hidden while it
 * is open (html.has-svc-page, styles in services.css) and the window scrolls it. As a fixed layer
 * with its own scroll box over the live app it left static bands on some Android phones (six
 * reports, see docs/DEVLOG.md). It appears instantly, and the phone's back button closes it.
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
  onCustomizePreset,
  onDelete
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const [shown, setShown] = useState(CATALOG_PAGE);
  useEffect(() => { setShown(CATALOG_PAGE); }, [activeCategory, query]);
  const page = visible.slice(0, shown);
  const hiddenCount = visible.length - page.length;

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

  const nameInputRef = useRef(null);

  // Never pop the keyboard just because the editor opened. Focus the name only
  // when there is something to type (a brand-new, still unnamed service) and the
  // device has a real keyboard (mouse / trackpad). On phones the owner taps the
  // field they actually want to change.
  const shouldFocusName = Boolean(open && draft && mode === "custom" && !draft.id && !String(draft.name || "").trim());
  useEffect(() => {
    if (!shouldFocusName || typeof window === "undefined") return;
    const hasRealKeyboard = window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
    if (hasRealKeyboard) nameInputRef.current?.focus({ preventScroll: true });
    // Run once per opening of an empty editor, not on every keystroke.
  }, [open, mode, draft?.id]);

  // The phone's back button closes the page and returns to where the owner was.
  const isShown = Boolean(open && draft);
  useBackHandler(isShown, onClose);

  // Hide the app underneath and start the page at the top; on close, put the owner back where they were.
  useLayoutEffect(() => {
    if (!isShown) return undefined;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    // The back-button history entry (useBackHandler) is added while the page is at the top, so the
    // browser's own restore would drop the owner at the top of their profile when it is popped.
    window.history.scrollRestoration = "manual";
    root.classList.add("has-svc-page");
    window.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      root.classList.remove("has-svc-page");
      window.scrollTo({ top: scrollY, behavior: "instant" });
      // Hand restoration back once the history entry is gone (popped now or within a moment),
      // unless the page was opened again meanwhile.
      window.setTimeout(() => {
        if (!root.classList.contains("has-svc-page")) window.history.scrollRestoration = "auto";
      }, 1000);
    };
  }, [isShown]);
  // Catalog and editor are two views of one page: switching starts the new one at the top.
  useLayoutEffect(() => {
    if (isShown) window.scrollTo({ top: 0, behavior: "instant" });
  }, [isShown, mode]);

  if (!open || !draft) return null;

  const editing = Boolean(draft.id);
  const canDelete = editing && typeof onDelete === "function";

  // Delete lives here (not on the card). The handler asks for confirmation and
  // reports whether the service was really removed; only then the sheet closes.
  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      const removed = await onDelete(draft.id);
      if (removed) onClose?.();
    } finally {
      setDeleting(false);
    }
  };
  const hasName = Boolean(draft.name.trim());
  const addedCount = addedNames.size;

  return createPortal(
    <div
      className="svcPage"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "ویرایش خدمت" : "افزودن خدمت"}
    >
      <article className={`svcSheet${mode === "preset" ? " is-catalog" : ""}`}>
        <header className="svcSheetHead">
          <button type="button" className="svcPageBack" onClick={onClose} aria-label="بازگشت">
            <ArrowRight size={20} aria-hidden="true" />
          </button>
          <div>
            <span>
              {!editing && addedCount
                ? `${toPersianDigits(addedCount)} خدمت توی منوته`
                : "خدمات"}
            </span>
            <h3>{editing ? "ویرایش خدمت" : "خدمت تازه"}</h3>
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
            از فهرست آماده
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            className={mode === "custom" ? "on" : ""}
            onClick={() => onModeChange?.("custom")}
          >
            <ServiceEmoji id="makeup_brush" size={20} />
            {editing ? "ویرایش" : "خودم می‌سازم"}
          </button>
        </div>

        {mode === "preset" ? (
          <div className="svcCatalog">
            <div className="svcCatalogScroll">
              <label className="svcSearch">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="دنبال چی می‌گردی؟ (مثلاً ژلیش، لیزر، شینیون)"
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
                روی خدمت بزن تا اسم و قیمتش رو عوض کنی، یا با + یه‌راست اضافه‌ش کن. چندتا پشت‌سرهم هم می‌شه.
              </p>

              <div className="svcPresetGrid" role="list">
                {visible.length === 0 ? (
                  <div className="svcEmptyState" role="status">
                    <ServiceIcon emoji="mirror" size="xl" />
                    <b>پیدا نشد</b>
                    <span>خودت بسازش.</span>
                    <button type="button" onClick={() => onModeChange?.("custom")}>
                      <Plus size={15} />
                      یه خدمت تازه بساز
                    </button>
                  </div>
                ) : null}
                {page.map((service) => {
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
                        <span className="svcPresetDone"><Check size={14} /> توی منوته</span>
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
              {hiddenCount > 0 ? (
                <button type="button" className="svcMoreBtn" onClick={() => setShown((count) => count + CATALOG_PAGE)}>
                  {toPersianDigits(hiddenCount)} تای دیگه
                </button>
              ) : null}
            </div>
            <div className="svcDoneBar">
              {addedCount ? (
                <div className="svcAddedStrip" aria-label={`${toPersianDigits(addedCount)} خدمت در منو`} aria-live="polite">
                  {[...existingServices].reverse().map((item) => (
                    <span className="svcAddedChip" key={item.id || item.name}>
                      <ServiceIcon emoji={item.emoji} name={item.name} size="xs" />
                      {item.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <button type="button" className="svcDoneBtn" onClick={onClose}>
                <Check size={18} aria-hidden="true" />
                {addedCount ? `تموم، ${toPersianDigits(addedCount)} خدمت توی منوته` : "بستن"}
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
                <small>{draft.emoji ? "عوض کردن آیکن" : "یه آیکن انتخاب کن"}</small>
              </button>
              <label className="svcField">
                <span>اسم خدمت</span>
                <input
                  value={draft.name}
                  onChange={(event) => onDraftChange?.({ name: event.target.value })}
                  placeholder="مثلاً شینیون کلاسیک"
                  required
                  ref={nameInputRef}
                />
              </label>
            </div>

            {suggestions.length ? (
              <div className="svcSuggest" role="group" aria-label="پیشنهاد از کاتالوگ">
                <small>یکی رو بزن تا قیمت و مدت پر بشه:</small>
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
              <p className="svcFormNote">قیمت رو خالی بذاری، «توافقی» نوشته می‌شه.</p>
            ) : null}

            <button type="submit" className="svcSubmit" disabled={!hasName || deleting}>
              <Check size={17} />
              {editing ? "ذخیره کن" : "بذارش توی منو"}
            </button>

            {canDelete ? (
              <button type="button" className="svcDeleteBtn" onClick={handleDelete} disabled={deleting}>
                <Trash2 size={16} />
                {deleting ? "دارم پاک می‌کنم…" : "این خدمت رو پاک کن"}
              </button>
            ) : null}
          </form>
        )}
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
    </div>,
    document.body
  );
}
