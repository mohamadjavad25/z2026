"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Small bottom sheet used by the report form: portal, Escape, backdrop click, focus on open. */
export function SupportShell({ title, label, above = false, onClose, children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector("form button, form input, form textarea, .supDone button")?.focus();
    // Capture phase + stopPropagation: when opened over the post viewer, Escape closes only this sheet.
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`supOverlay${above ? " is-above" : ""}`} onClick={onClose}>
      <div className="supSheet" role="dialog" aria-modal="true" aria-label={label || title} ref={ref} onClick={(event) => event.stopPropagation()}>
        <header className="supHead">
          <h3>{title}</h3>
          <button type="button" className="supX" onClick={onClose} aria-label="بستن پنجره"><X size={18} aria-hidden="true" /></button>
        </header>
        {children}
      </div>
    </div>,
    document.body
  );
}
