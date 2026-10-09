"use client";

import { useEffect, useState } from "react";
import { toPersianDigits } from "../shared/lib/digits";
import { CalendarCheck, Image as ImageIcon, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Menu, Moon, PanelLeft, ScrollText, ShieldCheck, Sun, Users, X } from "lucide-react";

const ICONS = {
  overview: LayoutDashboard,
  users: Users,
  content: ImageIcon,
  bookings: CalendarCheck,
  support: LifeBuoy,
  resets: KeyRound,
  security: ShieldCheck,
  actions: ScrollText
};
const STORAGE_KEY = "farfaroo_admin_nav";

/**
 * Collapsible left rail: icons only by default, opens to show labels (state is remembered per browser).
 * On a phone it becomes a drawer that opens from the menu button.
 */
export function AdminSidebar({ sections, active, onSelect, name, onLogout, theme, onToggleTheme, badges = {} }) {
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
          <span className="admBrand admSideLabel">Farfaroo</span>
          <button type="button" className="admSideClose" aria-label="پنهان‌کردن منو" onClick={() => setMobileOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="admSideNav" role="tablist" aria-label="بخش‌های مدیریت" aria-orientation="vertical">
          {sections.map((section) => (
            <div className="admSideGroup" key={section.id} role="presentation">
              {section.label ? <p className="admSideGroupLabel admSideLabel" aria-hidden="true">{section.label}</p> : <span className="admSideRule" aria-hidden="true" />}
              {section.items.map((item) => {
                const Icon = ICONS[item.id] || LayoutDashboard;
                const badge = Number(badges[item.id] || 0);
                const label = badge > 0 ? `${item.label} (${toPersianDigits(badge)} مورد)` : item.label;
                return (
                  <button key={item.id} type="button" role="tab" aria-selected={active === item.id} aria-label={label} title={label} className={active === item.id ? "is-on" : ""} onClick={() => pick(item.id)}>
                    <span className="admSideIcon">
                      <Icon size={20} aria-hidden="true" />
                      {badge > 0 ? <i className="admBadgeDot" aria-hidden="true" /> : null}
                    </span>
                    <span className="admSideLabel">{item.label}</span>
                    {badge > 0 ? <span className="admBadge admSideLabel" aria-hidden="true">{toPersianDigits(badge > 99 ? "99+" : badge)}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
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
