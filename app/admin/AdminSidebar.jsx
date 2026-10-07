"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Image as ImageIcon, KeyRound, LayoutDashboard, LogOut, Menu, Moon, PanelLeft, ScrollText, ShieldCheck, Sun, Users, X } from "lucide-react";

const ICONS = {
  overview: LayoutDashboard,
  users: Users,
  content: ImageIcon,
  bookings: CalendarCheck,
  resets: KeyRound,
  security: ShieldCheck,
  actions: ScrollText
};
const STORAGE_KEY = "zibaban_admin_nav";

/**
 * Collapsible left rail: icons only by default, opens to show labels (state is remembered per browser).
 * On a phone it becomes a drawer that opens from the menu button.
 */
export function AdminSidebar({ tabs, active, onSelect, name, onLogout, theme, onToggleTheme }) {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "open") setExpanded(true);
    } catch {
      // storage can be blocked; the rail simply starts collapsed
    }
  }, []);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
    } catch {
      // not essential
    }
  }

  function pick(id) {
    onSelect(id);
    setMobileOpen(false);
  }

  return (
    <>
      <button type="button" className="admBurger" aria-label="نمایش منو" onClick={() => setMobileOpen(true)}>
        <Menu size={22} aria-hidden="true" />
      </button>
      {mobileOpen ? <div className="admScrim" onClick={() => setMobileOpen(false)} aria-hidden="true" /> : null}
      <aside className={["admSide", expanded ? "is-open" : "", mobileOpen ? "is-mobile-open" : ""].filter(Boolean).join(" ")} aria-label="منوی مدیریت">
        <div className="admSideTop">
          <button type="button" className="admSideToggle" aria-label={expanded ? "جمع‌کردن منو" : "باز‌کردن منو"} aria-expanded={expanded} onClick={toggle}>
            <PanelLeft size={20} aria-hidden="true" />
          </button>
          <span className="admBrand admSideLabel">زیبابان</span>
          <button type="button" className="admSideClose" aria-label="پنهان‌کردن منو" onClick={() => setMobileOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="admSideNav" role="tablist" aria-label="بخش‌های مدیریت" aria-orientation="vertical">
          {tabs.map((item) => {
            const Icon = ICONS[item.id] || LayoutDashboard;
            return (
              <button key={item.id} type="button" role="tab" aria-selected={active === item.id} aria-label={item.label} title={item.label} className={active === item.id ? "is-on" : ""} onClick={() => pick(item.id)}>
                <Icon size={20} aria-hidden="true" />
                <span className="admSideLabel">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="admSideBottom">
          <span className="admSideUser admSideLabel" title={name}>{name || "مدیر"}</span>
          <button type="button" aria-label={theme === "dark" ? "حالت روشن" : "حالت تیره"} title={theme === "dark" ? "حالت روشن" : "حالت تیره"} onClick={onToggleTheme}>
            {theme === "dark" ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            <span className="admSideLabel">{theme === "dark" ? "حالت روشن" : "حالت تیره"}</span>
          </button>
          <button type="button" aria-label="خروج" title="خروج" onClick={onLogout}>
            <LogOut size={20} aria-hidden="true" />
            <span className="admSideLabel">خروج</span>
          </button>
        </div>
      </aside>
    </>
  );
}
