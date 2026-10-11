"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** The bottom sheet the connect flows share: dim backdrop, grab bar, title, close button. Closes on Escape. */
export function ConnectSheet({ label, icon = null, title, subtitle = "", onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="cnSheetRoot" role="dialog" aria-modal="true" aria-label={label || title}>
      <button type="button" className="cnSheetDim" aria-label="بستن" onClick={onClose} />
      <div className="cnSheetPanel">
        <span className="cnSheetGrab" aria-hidden="true" />
        <div className="cnSheetHead">
          {icon}
          <div>
            <b>{title}</b>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
          <button type="button" className="cnSheetClose" onClick={onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
