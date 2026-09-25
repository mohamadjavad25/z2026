"use client";

import { createPortal } from "react-dom";
import { QrCode, X } from "lucide-react";
import { useQrCode } from "../shared/hooks/useQrCode";

export function SalonQrCodeSheet({ open, url, name = "سالن", onOpenChange }) {
  const dataUrl = useQrCode(url, open);

  if (!open || typeof document === "undefined") return null;

  return createPortal((
    <div className="salonQrSheetOverlay" role="dialog" aria-modal="true" aria-label={`کد QR پروفایل ${name}`} onClick={(event) => { event.stopPropagation(); onOpenChange?.(false); }}>
      <article className="salonQrSheetCard" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="salonQrSheetClose" onClick={() => onOpenChange?.(false)} aria-label="بستن">
          <X size={18} />
        </button>
        <div className="salonQrSheetHead">
          <span><QrCode size={16} /> کد QR پروفایل</span>
          <h3>{name}</h3>
        </div>
        <div className="salonQrSheetImage">
          {dataUrl ? <img src={dataUrl} alt={`کد QR پروفایل عمومی ${name}`} /> : null}
        </div>
        <p className="salonQrSheetHint">با اسکن این کد، پروفایل عمومی سالن باز می‌شود.</p>
      </article>
    </div>
  ), document.body);
}
