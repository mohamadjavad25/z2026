"use client";

import { X } from "lucide-react";

/**
 * Close button for modal sheets, centered at the bottom (thumb reach) instead of
 * a small target in the top corner. Render it as the LAST child of the sheet: it
 * is sticky, so inside a scrolling sheet it stays pinned to the bottom edge.
 */
export function SheetClose({ onClick, disabled = false, label = "بستن" }) {
  return (
    <button type="button" className="sheetClose" onClick={onClick} disabled={disabled} aria-label={label}>
      <X size={20} />
    </button>
  );
}
