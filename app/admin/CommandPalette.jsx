"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Download, Image as ImageIcon, Keyboard, LifeBuoy, LogOut, Megaphone, Moon, Search, ToggleRight, UserRound } from "lucide-react";
import { api } from "./adminFetch";
import { STATUS_LABEL, TYPE_LABEL } from "./format";
import { TABS } from "./nav";
import { Kbd, exportCsv } from "./ui";

const norm = (text) => String(text || "").toLowerCase().replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").trim();

/**
 * One box to reach anything: pages, commands (export, theme, sign out) and live results from the whole site
 * (accounts, posts, support tickets). Arrow keys move, Enter opens, Esc closes.
 */
export function CommandPalette({ onClose, onGo, onToggleTheme, onLogout, onOpenHelp }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setFound(null);
      return undefined;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const result = await api.get(`/api/admin/search?q=${encodeURIComponent(term)}`);
      if (live && result.ok) setFound(result.payload.data);
    }, 220);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  const items = useMemo(() => {
    const term = norm(q);
    const match = (...texts) => !term || texts.some((text) => norm(text).includes(term));
    const commands = [
      { id: "cmd-broadcast", group: "فرمان‌ها", icon: Megaphone, label: "نوشتن پیام همگانی", run: () => onGo("broadcast") },
      { id: "cmd-notice", group: "فرمان‌ها", icon: ToggleRight, label: "روشن یا خاموش‌کردن اعلان بالای اپ", run: () => onGo("settings", { focus: "notice" }) },
      { id: "cmd-signups", group: "فرمان‌ها", icon: ToggleRight, label: "باز یا بسته‌کردن ثبت‌نام", run: () => onGo("settings", { focus: "signups" }) },
      { id: "cmd-export-users", group: "فرمان‌ها", icon: Download, label: "خروجی اکسل کاربران", run: () => exportCsv("users") },
      { id: "cmd-export-bookings", group: "فرمان‌ها", icon: Download, label: "خروجی اکسل رزروها", run: () => exportCsv("bookings") },
      { id: "cmd-theme", group: "فرمان‌ها", icon: Moon, label: "تغییر حالت روز و شب", hint: "T", run: onToggleTheme },
      { id: "cmd-keys", group: "فرمان‌ها", icon: Keyboard, label: "راهنمای میان‌برها", hint: "?", run: onOpenHelp },
      { id: "cmd-logout", group: "فرمان‌ها", icon: LogOut, label: "خروج از پنل", run: onLogout }
    ].filter((item) => match(item.label));
    const pages = TABS.filter((tab) => match(tab.label, tab.desc, tab.group)).map((tab) => ({
      id: `page-${tab.id}`, group: "صفحه‌ها", icon: tab.icon, label: tab.label, sub: tab.desc, hint: `G ${tab.key.toUpperCase()}`, run: () => onGo(tab.id)
    }));
    const live = found ? [
      ...found.users.map((user) => ({ id: `u${user.id}`, group: "کاربران", icon: UserRound, label: user.name || "بدون نام", sub: `${TYPE_LABEL[user.type] || ""} • ${user.phone}${user.suspended_at ? " • مسدود" : ""}`, run: () => onGo("users", { id: user.id }) })),
      ...found.tickets.map((ticket) => ({ id: `t${ticket.id}`, group: "پشتیبانی", icon: LifeBuoy, label: ticket.subject || (ticket.kind === "report" ? "گزارش" : "پیام"), sub: `${ticket.user_name || ticket.phone || "مهمان"} • ${STATUS_LABEL[ticket.status]}`, run: () => onGo("support", { id: ticket.id }) })),
      ...found.posts.map((post) => ({ id: `p${post.id}`, group: "پست‌ها", icon: ImageIcon, label: post.title, sub: `${post.owner_name || ""}${post.is_public ? "" : " • پنهان"}`, run: () => onGo("content", { q: post.title }) }))
    ] : [];
    return term ? [...live, ...pages, ...commands] : [...pages, ...commands];
  }, [q, found, onGo, onToggleTheme, onLogout, onOpenHelp]);

  useEffect(() => {
    setActive(0);
  }, [q, found]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function pick(item) {
    onClose();
    item?.run();
  }
  function onKey(event) {
    if (event.key === "ArrowDown") setActive((value) => Math.min(items.length - 1, value + 1));
    else if (event.key === "ArrowUp") setActive((value) => Math.max(0, value - 1));
    else if (event.key === "Enter") pick(items[active]);
    else if (event.key === "Escape") onClose();
    else return;
    event.preventDefault();
  }

  let lastGroup = "";
  return (
    <div className="admModal admPaletteWrap" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admPalette" role="dialog" aria-modal="true" aria-label="جست‌وجو و فرمان‌ها">
        <label className="admPaletteInput">
          <Search size={20} aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={onKey}
            placeholder="نام یا شمارهٔ کاربر، پست، پیام، یا اسم یک صفحه…"
            role="combobox"
            aria-expanded="true"
            aria-controls="admPaletteList"
            aria-activedescendant={items[active] ? `adm-cmd-${items[active].id}` : undefined}
          />
          <Kbd>Esc</Kbd>
        </label>
        <ul className="admPaletteList" id="admPaletteList" role="listbox" ref={listRef}>
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <li key={item.id} role="presentation">
                {header ? <p className="admPaletteGroup">{header}</p> : null}
                <button
                  type="button"
                  id={`adm-cmd-${item.id}`}
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  className={index === active ? "is-active" : ""}
                  onMouseMove={() => setActive(index)}
                  onClick={() => pick(item)}
                >
                  <span className="admPaletteIcon"><Icon size={17} aria-hidden="true" /></span>
                  <span className="admPaletteText"><b>{item.label}</b>{item.sub ? <small>{item.sub}</small> : null}</span>
                  {item.hint ? <span className="admPaletteHint">{item.hint}</span> : index === active ? <CornerDownLeft size={15} aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
          {!items.length ? <li className="admPaletteNone">{q.trim().length >= 2 && !found ? "در حال جست‌وجو…" : "چیزی پیدا نشد."}</li> : null}
        </ul>
        <footer className="admPaletteFoot"><span><Kbd>↑</Kbd><Kbd>↓</Kbd> جابه‌جایی</span><span><Kbd>Enter</Kbd> باز کردن</span><span><Kbd>?</Kbd> همهٔ میان‌برها</span></footer>
      </div>
    </div>
  );
}
