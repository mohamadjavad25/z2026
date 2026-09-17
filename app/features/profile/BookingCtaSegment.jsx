"use client";

import { Plus } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";

export function BookingCtaSegment({
  title = "ایجاد رزرو",
  count = 0,
  hint = "",
  active = false,
  onClick
}) {
  const detail = hint || `${toPersianDigits(count)} نوبت`;

  return (
    <button
      type="button"
      className={`ctaSegment ctaManage ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-label={title}
      aria-pressed={active}
    >
      <span className="ctaIcon"><Plus size={18} /></span>
      <span className="ctaText">
        <b>{title}</b>
        <small>{detail}</small>
      </span>
    </button>
  );
}
