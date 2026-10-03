"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { BEAUTY_EMOJIS, EMOJI_CATEGORIES } from "../shared/constants/beautyEmoji";
import { ServiceEmoji } from "./ServiceEmoji";

/** Bottom-sheet icon picker (search + category tabs). */
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
    <div className="serviceEmojiOverlay" role="dialog" aria-modal="true" aria-label="انتخاب آیکن خدمت" onClick={onClose}>
      <div className="serviceEmojiSheet" onClick={(event) => event.stopPropagation()}>
        <div className="serviceEmojiSheetHead">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو… (مثلاً ناخن، رنگ، لیزر)"
            aria-label="جستجوی آیکن"
          />
          <button type="button" onClick={onClose} aria-label="بستن"><X size={17} /></button>
        </div>
        <div className="serviceEmojiTabs" role="tablist">
          {[{ id: "all", fa: "همه" }, ...EMOJI_CATEGORIES].map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={category === item.id}
              className={category === item.id ? "on" : ""}
              key={item.id}
              onClick={() => setCategory(item.id)}
            >
              {item.fa}
            </button>
          ))}
        </div>
        <div className="serviceEmojiGrid">
          {items.length === 0 ? <p className="serviceEmojiEmpty">آیکنی پیدا نشد.</p> : null}
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={value === item.id ? "on" : ""}
              onClick={() => onPick?.(item.id)}
            >
              <ServiceEmoji id={item.id} size={40} />
              <span>{item.fa}</span>
            </button>
          ))}
        </div>
        {value ? (
          <button type="button" className="serviceEmojiClear" onClick={() => onPick?.("")}>حذف آیکن</button>
        ) : null}
      </div>
    </div>
  );
}
