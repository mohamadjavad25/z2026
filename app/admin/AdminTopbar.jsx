"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, LifeBuoy, Search, UserRound } from "lucide-react";
import { apiFetch } from "../shared/api/client";
import { STATUS_LABEL } from "./format";

/** One search box for the whole panel (Ctrl/⌘+K): accounts, posts and support tickets. Picking a result opens it in its own page. */
export function AdminTopbar({ onGo }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults(null);
      return undefined;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const { ok, payload } = await apiFetch(`/api/admin/search?q=${encodeURIComponent(term)}`);
      if (live && ok) setResults(payload.data);
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  function pick(tab, params) {
    setOpen(false);
    setQ("");
    setResults(null);
    onGo(tab, params);
  }

  const none = results && !results.users.length && !results.posts.length && !results.tickets.length;
  return (
    <div className="admTopbar" ref={boxRef}>
      <label className="admSearch">
        <Search size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          placeholder="جستجوی سریع: نام یا شمارهٔ کاربر، پست، پیام…"
          aria-label="جستجوی سریع در همهٔ بخش‌ها"
          onChange={(event) => { setQ(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => event.key === "Escape" && (setOpen(false), event.currentTarget.blur())}
        />
        <kbd aria-hidden="true">Ctrl K</kbd>
      </label>
      {open && q.trim().length >= 3 && results ? (
        <div className="admResults" role="listbox" aria-label="نتیجه‌های جستجو">
          {none ? <p className="admMuted">چیزی پیدا نشد.</p> : null}
          {results.users.length ? <p className="admResultsGroup">کاربران</p> : null}
          {results.users.map((user) => (
            <button key={`u${user.id}`} type="button" role="option" onClick={() => pick("users", { userId: user.id })}>
              <UserRound size={16} aria-hidden="true" /> <b>{user.name || "بدون نام"}</b> <small dir="ltr">{user.phone}</small>{user.suspended_at ? <em>مسدود</em> : null}
            </button>
          ))}
          {results.tickets.length ? <p className="admResultsGroup">پشتیبانی</p> : null}
          {results.tickets.map((ticket) => (
            <button key={`t${ticket.id}`} type="button" role="option" onClick={() => pick("support", { ticketId: ticket.id })}>
              <LifeBuoy size={16} aria-hidden="true" /> <b>{ticket.subject || (ticket.kind === "report" ? "گزارش" : "پیام")}</b> <small>{ticket.user_name || ticket.phone || "مهمان"} • {STATUS_LABEL[ticket.status]}</small>
            </button>
          ))}
          {results.posts.length ? <p className="admResultsGroup">پست‌ها</p> : null}
          {results.posts.map((post) => (
            <button key={`p${post.id}`} type="button" role="option" onClick={() => pick("content", { q: post.title })}>
              <ImageIcon size={16} aria-hidden="true" /> <b>{post.title}</b> <small>{post.owner_name}</small>{post.is_public ? null : <em>پنهان</em>}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
