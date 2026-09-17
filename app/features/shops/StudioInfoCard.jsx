"use client";

import { ChevronLeft } from "lucide-react";

/**
 * Reusable stat/action row for the shop studio dashboard — same shell as
 * the wallet card (icon chip + big figure + optional trailing action),
 * themeable via `tone` so it fits wallet, discounts, alerts, etc.
 */
export function StudioInfoCard({
  icon: Icon,
  tone = "wine",
  value,
  label,
  actionLabel,
  onAction,
  loading = false
}) {
  return (
    <div className={`studioInfoCard is-${tone}`}>
      {Icon ? (
        <span className="studioInfoCardIcon" aria-hidden="true">
          <Icon size={20} />
        </span>
      ) : null}
      <div className="studioInfoCardFigure">
        <strong className="studioNumeral">{loading ? "…" : value}</strong>
        <span>{label}</span>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="studioLinkButton" onClick={onAction}>
          {actionLabel}
          <ChevronLeft size={14} />
        </button>
      ) : null}
    </div>
  );
}
