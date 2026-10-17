"use client";

import { useEffect, useRef } from "react";
import { Keyboard, X } from "lucide-react";
import { TABS } from "./nav";
import { Kbd } from "./ui";

const typing = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Keyboard control for one person running everything: Ctrl/⌘+K or / opens the command palette, g then a letter
 * jumps to a page (g u = users), t switches day/night, ? lists every shortcut. Nothing fires while typing in a field.
 */
export function useShortcuts({ enabled, go, openPalette, openHelp, toggleTheme }) {
  const pendingG = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      const key = event.key.toLowerCase();
      if (Date.now() - pendingG.current < 1200) {
        pendingG.current = 0;
        const target = TABS.find((tab) => tab.key === key);
        if (target) {
          event.preventDefault();
          go(target.id);
        }
        return;
      }
      if (key === "g") pendingG.current = Date.now();
      else if (key === "/") {
        event.preventDefault();
        openPalette();
      } else if (event.key === "?") openHelp();
      else if (key === "t") toggleTheme();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, go, openPalette, openHelp, toggleTheme]);
}

export function ShortcutsHelp({ onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="admModal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admCard admDialog admHelp" role="dialog" aria-modal="true" aria-labelledby="admHelpTitle">
        <header className="admCardHead">
          <h2 id="admHelpTitle"><Keyboard size={18} aria-hidden="true" /> میان‌برهای صفحه‌کلید</h2>
          <button type="button" className="admIconBtn" aria-label="بستن" onClick={onClose} autoFocus><X size={18} aria-hidden="true" /></button>
        </header>
        <ul className="admKeys">
          <li><span>جست‌وجو و فرمان‌ها</span><span><Kbd>Ctrl</Kbd> <Kbd>K</Kbd> یا <Kbd>/</Kbd></span></li>
          <li><span>تغییر حالت روز و شب</span><Kbd>T</Kbd></li>
          <li><span>همین راهنما</span><Kbd>?</Kbd></li>
          <li><span>ارسال پاسخ در پشتیبانی</span><span><Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd></span></li>
        </ul>
        <h3 className="admKeysHead">رفتن به صفحه: اول <Kbd>G</Kbd> بعد حرف صفحه</h3>
        <ul className="admKeys is-grid">
          {TABS.map((tab) => <li key={tab.id}><span>{tab.label}</span><span><Kbd>G</Kbd> <Kbd>{tab.key.toUpperCase()}</Kbd></span></li>)}
        </ul>
      </section>
    </div>
  );
}
