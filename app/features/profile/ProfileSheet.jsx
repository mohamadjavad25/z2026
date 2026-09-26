"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function ProfileSheet({ open, kicker = "پروفایل", title, label, panelClassName = "", hideHeader = false, onClose, children }) {
  // Every sheet in the app shares this shell, so Escape-to-close only
  // needs to live in one place to cover all of them.
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const panelClasses = String(panelClassName || "").trim();
  const isHistorySheet = panelClasses.includes("bookingWeekHistorySheet");

  return createPortal(
    <div
      className={`salonHeroSheetBackdrop ${isHistorySheet ? "bookingWeekHistorySheetBackdrop" : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={label || title}
      onClick={onClose}
    >
      <aside className={`salonHeroSheetPanel ${panelClasses}`.trim()} onClick={(event) => event.stopPropagation()}>
        {hideHeader ? null : (
          <div className="salonHeroSheetHead">
            <div>
              <span>{kicker}</span>
              <h3>{title}</h3>
            </div>
            <button type="button" onClick={onClose} aria-label={`بستن ${title}`}>
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </aside>
    </div>,
    document.body
  );
}
