"use client";

import { Bell, Keyboard, Search } from "lucide-react";
import { toPersianDigits } from "../shared/lib/digits";
import { tabInfo } from "./nav";
import { Kbd } from "./ui";

/**
 * The bar above every page: where you are, one search box for everything (it opens the command palette), and a bell
 * that sums what is waiting for you across the panel.
 */
export function AdminTopbar({ tab, onOpenPalette, onOpenHelp, onGo, badges = {} }) {
  const info = tabInfo(tab);
  const waiting = (badges.support || 0) + (badges.resets || 0);
  return (
    <div className="admTopbar">
      <div className="admCrumb" aria-hidden="true">
        <span>{info.group || "خانه"}</span>
        <b>{info.label}</b>
      </div>
      <button type="button" className="admSearch" onClick={onOpenPalette} aria-label="جست‌وجو در همه‌جا و فرمان‌ها (Ctrl+K)">
        <Search size={18} aria-hidden="true" />
        <span>جست‌وجو: کاربر، شماره، پست، پیام یا یک فرمان…</span>
        <span className="admSearchKeys"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
      </button>
      <div className="admTopActions">
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
