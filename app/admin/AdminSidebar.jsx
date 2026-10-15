"use client";

import { useEffect, useState } from "react";
import { toPersianDigits } from "../shared/lib/digits";
import { LogOut, Menu, Moon, PanelLeft, Sun, X } from "lucide-react";

const STORAGE_KEY = "frfro_admin_nav";

/**
 * Collapsible rail: icons only or icons with labels (remembered per browser). On a phone it becomes a drawer that opens
 * from the menu button. Each item shows its waiting count, and its keyboard shortcut in the tooltip.
 */
export function AdminSidebar({ sections, active, onSelect, name, onLogout, theme, onToggleTheme, badges = {} }) {
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "closed") setExpanded(false);
    } catch {
      // storage can be blocked; the rail simply starts open
    }
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

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

  const initial = Array.from(String(name || "م").trim())[0] || "م";
  return (
    <>
      <button type="button" className="admBurger" aria-label="نمایش منو" onClick={() => setMobileOpen(true)}>
        <Menu size={22} aria-hidden="true" />
        {Object.values(badges).some((value) => value > 0) ? <i className="admBadgeDot" aria-hidden="true" /> : null}
      </button>
      {mobileOpen ? <div className="admScrim" onClick={() => setMobileOpen(false)} aria-hidden="true" /> : null}
      <aside className={["admSide", expanded ? "is-open" : "", mobileOpen ? "is-mobile-open" : ""].filter(Boolean).join(" ")} aria-label="منوی مدیریت">
        <div className="admSideTop">
          <button type="button" className="admSideToggle" aria-label={expanded ? "جمع‌کردن منو" : "باز‌کردن منو"} aria-expanded={expanded} onClick={toggle}>
            <PanelLeft size={20} aria-hidden="true" />
          </button>
          <span className="admBrand admSideLabel">frfro <small>اتاق فرمان</small></span>
          <button type="button" className="admSideClose" aria-label="پنهان‌کردن منو" onClick={() => setMobileOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="admSideNav" aria-label="بخش‌های مدیریت">
          {sections.map((section) => (
            <div className="admSideGroup" key={section.id} role="group" aria-label={section.label || "خانه"}>
              {section.label ? <p className="admSideGroupLabel admSideLabel" aria-hidden="true">{section.label}</p> : null}
              {section.items.map((item) => {
                const Icon = item.icon;
                const badge = Number(badges[item.id] || 0);
                const label = badge > 0 ? `${item.label} (${toPersianDigits(badge)} مورد)` : item.label;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active === item.id ? "page" : undefined}
                    aria-label={label}
                    title={`${label} — G ${item.key.toUpperCase()}`}
                    className={active === item.id ? "is-on" : ""}
                    onClick={() => pick(item.id)}
                  >
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
          <span className="admSideAvatar" aria-hidden="true" title={name}>{initial}</span>
          <span className="admSideLabel admSideUser" title={name}>{name || "مدیر"}<small>مدیر کل</small></span>
          <button type="button" className="admSideMini" aria-label={theme === "dark" ? "حالت روز" : "حالت شب"} title={`${theme === "dark" ? "حالت روز" : "حالت شب"} — T`} onClick={onToggleTheme}>
            {theme === "dark" ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
          </button>
          <button type="button" className="admSideMini" aria-label="خروج" title="خروج" onClick={onLogout}>
            <LogOut size={19} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}
