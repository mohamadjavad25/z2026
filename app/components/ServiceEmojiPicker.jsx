"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { BEAUTY_EMOJIS, EMOJI_CATEGORIES } from "../shared/constants/beautyEmoji";
import { ServiceEmoji } from "./ServiceEmoji";
import { ServiceIcon } from "./ServiceIcon";

/** Bottom-sheet icon picker (search + category tabs with their own icons). */
export function ServiceEmojiPicker({ open, value = "", onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BEAUTY_EMOJIS.filter((item) => (
      (category === "all" || item.category === category)
      && (!q || `${item.fa} ${item.en} ${item.tags.join(" ")}`.toLowerCase().includes(q))
    ));
  }, [query, category]);

  if (!open) return null;

  return (
    <div className="svcPickerOverlay" role="dialog" aria-modal="true" aria-label="انتخاب آیکن خدمت" onClick={onClose}>
      <div className="svcPicker" onClick={(event) => event.stopPropagation()}>
        <div className="svcPickerHead">
          <strong>آیکن خدمت</strong>
          <button type="button" className="svcPickerClose" onClick={onClose} aria-label="بستن"><X size={18} /></button>
        </div>
        <label className="svcSearch">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو… (مثلاً ناخن، رنگ، لیزر)"
            aria-label="جستجوی آیکن"
          />
        </label>
        <div className="svcTabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={category === "all"}
            className={category === "all" ? "on" : ""}
            onClick={() => setCategory("all")}
          >
            <ServiceEmoji id="sparkles" size={20} />
            همه
          </button>
          {EMOJI_CATEGORIES.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={category === item.id}
              className={category === item.id ? "on" : ""}
              key={item.id}
              onClick={() => setCategory(item.id)}
            >
              <ServiceEmoji id={item.icon} size={20} />
              {item.fa}
            </button>
          ))}
        </div>
        <div className="svcPickerGrid">
          {items.length === 0 ? <p className="svcEmpty">آیکنی پیدا نشد.</p> : null}
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={value === item.id ? "on" : ""}
              onClick={() => onPick?.(item.id)}
              aria-pressed={value === item.id}
            >
              <ServiceIcon emoji={item.id} size="md" />
              <span>{item.fa}</span>
            </button>
          ))}
        </div>
        {value ? (
          <button type="button" className="svcPickerClear" onClick={() => onPick?.("")}>حذف آیکن (انتخاب خودکار)</button>
        ) : null}
      </div>
    </div>
  );
}
