"use client";

import { Bell, Keyboard, Search } from "lucide-react";
import { toPersianDigits } from "../shared/lib/digits";
import { Kbd } from "./ui";
import { askClaude, ClaudeMark } from "./ClaudeConnect";

/**
 * The bar above every page: one search box for everything (it opens the command palette) and a bell that sums what is
 * waiting for you. Where you are is already said by the highlighted rail item and the page's own title.
 */
export function AdminTopbar({ onOpenPalette, onOpenHelp, onGo, badges = {} }) {
  const waiting = (badges.support || 0) + (badges.resets || 0);
  return (
    <div className="admTopbar">
      <button type="button" className="admSearch" onClick={onOpenPalette} aria-label="جست‌وجو در همه‌جا و فرمان‌ها (Ctrl+K)">
        <Search size={18} aria-hidden="true" />
        <span>جست‌وجو: کاربر، شماره، پست، پیام یا یک فرمان…</span>
        <span className="admSearchKeys"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
      </button>
      <div className="admTopActions">
        <button type="button" className="admIconBtn is-lg admClaudeBtn" aria-label="بده به Claude" title="مشکل این صفحه را به Claude بده" onClick={() => askClaude()}><ClaudeMark size={20} /></button>
        <button type="button" className="admIconBtn is-lg" aria-label={waiting ? `${toPersianDigits(waiting)} مورد منتظر توست` : "چیزی منتظر نیست"} title="منتظر تو" onClick={() => onGo(badges.support ? "support" : badges.resets ? "resets" : "overview")}>
          <Bell size={19} aria-hidden="true" />
          {waiting ? <span className="admTopCount">{toPersianDigits(waiting > 99 ? "99+" : waiting)}</span> : null}
        </button>
        <button type="button" className="admIconBtn is-lg admHideNarrow" aria-label="میان‌برهای صفحه‌کلید" title="میان‌برها (?)" onClick={onOpenHelp}>
          <Keyboard size={19} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
