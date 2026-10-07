"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SheetClose } from "../../components/SheetClose";

export function ProfileSheet({ open, kicker = "پروفایل", title, label, panelClassName = "", hideHeader = false, onClose, children }) {
  // Every sheet in the app shares this shell, so Escape-to-close only
  // needs to live in one place to cover all of them.
  const panelRef = useRef(null);

  // Keyboard / screen-reader support: focus moves into the sheet when it opens, Tab stays
  // inside it, and focus returns to whatever opened it when it closes.
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const focusable = () => [...(panelRef.current?.querySelectorAll(
      "a[href], button:not([disabled]), input:not([disabled]):not([tabindex='-1']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    ) || [])].filter((el) => el.offsetParent !== null);
    const raf = requestAnimationFrame(() => {
      if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus({ preventScroll: true });
    });
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    };
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
      <aside ref={panelRef} tabIndex={-1} className={`salonHeroSheetPanel ${panelClasses}`.trim()} onClick={(event) => event.stopPropagation()}>
        {hideHeader ? null : (
          <div className="salonHeroSheetHead">
            <div>
              {kicker ? <span>{kicker}</span> : null}
              <h3>{title}</h3>
            </div>
          </div>
        )}
        {children}
        <SheetClose onClick={onClose} label={`بستن ${title || ""}`.trim()} />
      </aside>
    </div>,
    document.body
  );
}
