"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Close button for modal sheets, centered at the bottom (thumb reach) instead of
 * a small target in the top corner. Render it as the LAST child of the sheet.
 *
 * The button itself is portaled to <body>: a `position: fixed` element is positioned against
 * the nearest ancestor that has a transform / filter / backdrop-filter / contain, and most
 * sheets have one (slide-in animation, blur), which made the button scroll away with the sheet.
 * In <body> it is always pinned to the viewport. A same-height spacer stays in the sheet so
 * the last content is never hidden under the button.
 */
export function SheetClose({ onClick, disabled = false, label = "بستن" }) {
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
