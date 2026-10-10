"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, X } from "lucide-react";
import { ServiceIcon } from "./ServiceIcon";
import { ServiceIconStrip } from "./ServiceIconStrip";
import { EMOJI_CATEGORIES, getBeautyEmoji, guessBeautyEmojiId } from "../shared/constants/beautyEmoji";
import { formatTomanNumber, parseTomanAmount } from "../shared/lib/money";
import { toPersianDigits } from "../shared/lib/digits";

const OTHER = { id: "other", fa: "سایر" };

export function serviceKey(service) {
  return String(service?.id ?? service?.name ?? "");
}

// Groups services by the category of their icon (the same categories as the
// icon picker), in the picker's order; anything unmatched goes under «سایر».
function groupServices(services) {
  const buckets = new Map();
  services.forEach((service) => {
    const id = getBeautyEmoji(service.emoji) ? service.emoji : guessBeautyEmojiId(service.name);
    const category = getBeautyEmoji(id)?.category;
    const key = EMOJI_CATEGORIES.some((item) => item.id === category) ? category : OTHER.id;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(service);
  });
  return [...EMOJI_CATEGORIES, OTHER]
    .filter((category) => buckets.has(category.id))
    .map((category) => ({ id: category.id, label: category.fa, items: buckets.get(category.id) }));
}

/**
 * The public salon/artist page's services menu: opens upward from the bottom
 * bar's «خدمات» button, services grouped by category; picking one and
 * confirming hands it to `onConfirm`. Render it next to the `.spvBar`.
 */
export function ServicesDropUp({ open, title, services, selectedKey = "", onSelect, onConfirm, onClose }) {
  const list = Array.isArray(services) ? services : [];
  const groups = useMemo(() => groupServices(list), [list]);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const showTabs = groups.length > 2;
  const visible = showTabs && tab !== "all" ? groups.filter((group) => group.id === tab) : groups;
  const picked = list.find((service) => serviceKey(service) === selectedKey) || null;
  const pickedAmount = picked ? parseTomanAmount(picked.price) : 0;

  return (
    <>
      <button type="button" className="sduDim" aria-label="بستن فهرست خدمات" onClick={onClose} />
      <div className="sduPanel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sduInner">
          <div className="sduHead">
            <div>
              <b>{title}</b>
              {list.length ? <small>{toPersianDigits(list.length)} خدمت · خدمت مورد نظرت را انتخاب کن</small> : null}
            </div>
            <button type="button" className="sduClose" aria-label="بستن" onClick={onClose}>
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>

          {list.length === 0 ? (
            <div className="sduEmpty" role="status">
              <ServiceIconStrip size="md" />
              <b>هنوز خدمتی ثبت نشده</b>
              <span>فعلاً خدمتی برای رزرو آنلاین اضافه نشده؛ بعداً سر بزن.</span>
            </div>
          ) : (
            <>
              {showTabs ? (
                <div className="sduTabs" role="tablist" aria-label="دسته‌بندی خدمات">
                  {[{ id: "all", label: "همه" }, ...groups].map((group) => (
                    <button
                      type="button"
                      role="tab"
                      key={group.id}
                      aria-selected={tab === group.id}
                      className={tab === group.id ? "is-active" : ""}
                      onClick={() => setTab(group.id)}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="sduList">
                {visible.map((group) => (
                  <section className="sduGroup" key={group.id} aria-label={group.label}>
                    {groups.length > 1 ? (
                      <div className="sduGroupHead">
                        <span>{group.label}</span>
                        <i aria-hidden="true" />
                        <small>{toPersianDigits(group.items.length)} خدمت</small>
                      </div>
                    ) : null}
                    {group.items.map((service) => {
                      const key = serviceKey(service);
                      const amount = parseTomanAmount(service.price);
                      const on = key === selectedKey;
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`sduItem${on ? " is-selected" : ""}`}
                          aria-pressed={on}
                          onClick={() => onSelect(on ? null : service)}
                        >
                          <ServiceIcon emoji={service.emoji} name={service.name} size="sm" />
                          <span className="sduItemBody">
                            <b>{service.name}</b>
                            <small>{service.duration || "زمان متغیر"}</small>
                          </span>
                          <span className="sduItemPrice">
                            {amount ? <>{formatTomanNumber(amount)} <small>تومان</small></> : <small>قیمت توافقی</small>}
                          </span>
                          <span className="sduRadio" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </section>
                ))}
              </div>

              <div className="sduFoot">
                <button type="button" className="sduConfirm" disabled={!picked} onClick={() => picked && onConfirm(picked)}>
                  <CalendarCheck size={18} />
                  {picked ? `رزرو «${picked.name}»` : "یک خدمت انتخاب کن"}
                  {pickedAmount ? <small>{formatTomanNumber(pickedAmount)} تومان</small> : null}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
