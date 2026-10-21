"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Flag, Link2, UserMinus } from "lucide-react";
import { SupportCenter } from "../support";

const SETTLE_MS = 2000;

/**
 * «وصل شو» / «وصل هستی» on a salon's or artist's public page. Right after connecting it says
 * «وصل هستی» for two seconds, then settles into the linked look; tapping that opens a small menu
 * under it, as wide as the button, with «قطع اتصال» and «گزارش به پشتیبانی» (the support chat,
 * a complaint already titled with this page's name).
 */
export function ConnectToggle({ following, onToggle, name = "", kind = "سالن", icon }) {
  // Already connected when the page opened: no «just connected» moment, straight to the linked look.
  const [settled, setSettled] = useState(Boolean(following));
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const wasFollowing = useRef(Boolean(following));
  const rootRef = useRef(null);

  useEffect(() => {
    if (following && !wasFollowing.current) {
      setSettled(false);
      const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
      wasFollowing.current = true;
      return () => window.clearTimeout(timer);
    }
    if (!following) {
      wasFollowing.current = false;
      setOpen(false);
    }
    return undefined;
  }, [following]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!following) {
    return (
      <button type="button" className="pphFollow" onClick={onToggle}>
        {icon}
        وصل شو
      </button>
    );
  }

  if (!settled) {
    return (
      <button type="button" className="pphFollow is-following is-fresh" onClick={() => setSettled(true)}>
        <Check size={18} />
        وصل هستی
      </button>
    );
  }

  const title = name ? `گزارش ${kind} «${name}»` : `گزارش ${kind}`;
  return (
    <div className={`pphConnect${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="pphFollow is-linked"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="pphLinkedMark" aria-hidden="true"><Link2 size={16} strokeWidth={2.6} /></span>
        وصل هستی
        <ChevronDown size={16} className="pphLinkedChevron" aria-hidden="true" />
      </button>
      <div className="pphConnectMenu" role="menu" aria-hidden={!open} inert={!open || undefined}>
        <div>
          <button type="button" role="menuitem" className="pphConnectItem" onClick={() => { setOpen(false); onToggle(); }}>
            <UserMinus size={17} aria-hidden="true" />
            قطع اتصال
          </button>
          <button type="button" role="menuitem" className="pphConnectItem is-report" onClick={() => { setOpen(false); setReporting(true); }}>
            <Flag size={17} aria-hidden="true" />
            گزارش به پشتیبانی
          </button>
        </div>
      </div>
      {reporting ? (
        <SupportCenter initial={{ view: "new", category: "complaint", subject: title }} onClose={() => setReporting(false)} />
      ) : null}
    </div>
  );
}
