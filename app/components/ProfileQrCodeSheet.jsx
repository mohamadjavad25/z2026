"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ScanLine, Share2 } from "lucide-react";
import { useQrCode } from "../shared/hooks/useQrCode";
import { SheetClose } from "./SheetClose";

/**
 * «اسکن شو» for salons and artists: the QR of their public page. Scanned in
 * frfro it connects a client, lets an artist join a salon's team, or lets a
 * salon invite an artist (features/connect/ScanFlow); any other camera just
 * opens the page. `onScan` adds an «اسکن کن» button for the other direction.
 */
export function ProfileQrCodeSheet({ open, url, name = "پروفایل", hint = "مشتری‌ها با اسکن این کد در فرفرو به تو وصل می‌شوند.", onScan, onOpenChange }) {
  const dataUrl = useQrCode(url, open);
  const [copied, setCopied] = useState(false);

  if (!open || typeof document === "undefined") return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable — the QR code itself still works
    }
  }

  async function shareLink() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    copyLink();
  }

  return createPortal((
    <div className="salonQrSheetOverlay" role="dialog" aria-modal="true" aria-label={`کد QR پروفایل ${name}`} onClick={(event) => { event.stopPropagation(); onOpenChange?.(false); }}>
      <article className="salonQrSheetCard qrsCard" onClick={(event) => event.stopPropagation()}>
        <p className="qrsBrand" aria-hidden="true">frfro</p>
        <h3 className="qrsName">{name}</h3>
        <div className="qrsScan">
          <span className="ivtCorner is-tl" aria-hidden="true" />
          <span className="ivtCorner is-tr" aria-hidden="true" />
          <span className="ivtCorner is-bl" aria-hidden="true" />
          <span className="ivtCorner is-br" aria-hidden="true" />
          <div className="qrsImage">
            {dataUrl ? <img src={dataUrl} alt={`کد QR پروفایل عمومی ${name}`} /> : <span className="ivtQrWait" />}
          </div>
        </div>
        <p className="qrsHint">{hint}</p>
        <div className="ivtActions">
          <button type="button" className="ivtShare" onClick={shareLink}>
            <Share2 size={17} aria-hidden="true" />
            اشتراک‌گذاری
          </button>
          <button type="button" className={`ivtCopyBtn ${copied ? "is-done" : ""}`} onClick={copyLink} aria-label={copied ? "کپی شد" : "کپی لینک"}>
            {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            <span>{copied ? "کپی شد" : "کپی"}</span>
          </button>
        </div>
        {typeof onScan === "function" ? (
          <button type="button" className="qrsScanBtn" onClick={onScan}>
            <ScanLine size={18} aria-hidden="true" />
            اسکن کن
          </button>
        ) : null}
        <SheetClose onClick={() => onOpenChange?.(false)} />
      </article>
    </div>
  ), document.body);
}
