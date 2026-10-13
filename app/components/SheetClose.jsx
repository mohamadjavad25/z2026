"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBackHandler } from "../shared/hooks/useBackHandler";

/**
 * Close button for modal sheets, centered at the bottom (thumb reach) instead of
 * a small target in the top corner. Render it as the LAST child of the sheet.
 *
 * The button itself is portaled to <body>: a `position: fixed` element is positioned against
 * the nearest ancestor that has a transform / filter / backdrop-filter / contain, and most
 * sheets have one (slide-in animation, blur), which made the button scroll away with the sheet.
 * In <body> it is always pinned to the viewport. A same-height spacer stays in the sheet so
 * the last content is never hidden under the button.
 *
 * Every sheet renders this while it is open, so it is also where the phone's back
 * button closes the sheet instead of leaving the app.
 */
export function SheetClose({ onClick, disabled = false, label = "بستن" }) {
  useBackHandler(true, () => {
    if (disabled) return false;
    onClick?.();
  });
  const button = (
    <button type="button" className="sheetClose" onClick={onClick} disabled={disabled} aria-label={label}>
      <X size={20} />
    </button>
  );
  return (
    <>
      <span className="sheetCloseSpacer" aria-hidden="true" />
      {typeof document === "undefined" ? null : createPortal(button, document.body)}
    </>
  );
}
