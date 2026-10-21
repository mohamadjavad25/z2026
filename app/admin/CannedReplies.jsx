"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MessageSquareQuote, Search, Sparkles } from "lucide-react";
import { api } from "./adminFetch";
import { REPLY_SAMPLES, fillReply } from "./samples";

let cache = null;
/** Forgets the saved replies so the next reply box loads the edited list (called after Settings saves them). */
export function forgetCannedReplies() {
  cache = null;
}

/**
 * "Ready replies" as one button above a reply box. It opens a small list: your saved replies first, then frfro's
 * example replies (so a fresh panel is never empty). Picking one inserts it, with {name} filled in. Esc or a click
 * outside closes it.
 */
export function CannedReplies({ onPick, name = "" }) {
  const [items, setItems] = useState(cache || []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef(null);
  useEffect(() => {
    if (cache) return undefined;
    let live = true;
    api.get("/api/admin/settings").then((result) => {
      if (!live || !result.ok) return;
      cache = result.payload.data.replies.items || [];
      setItems(cache);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);
  const needle = q.trim();
  const match = (item) => !needle || item.title.includes(needle) || item.body.includes(needle);
  const mine = useMemo(() => items.filter(match), [items, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const samples = useMemo(() => REPLY_SAMPLES.filter(match), [needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (body) => {
    onPick(fillReply(body, name));
    setOpen(false);
    setQ("");
  };
  return (
    <div className="admReplyPicker" ref={box}>
      <button type="button" className="admChipLink" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((value) => !value)}>
        <MessageSquareQuote size={15} aria-hidden="true" /> پاسخ آماده <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="admReplyPop" role="menu" aria-label="پاسخ‌های آماده">
          <label className="admInlineSearch">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={q} autoFocus placeholder="جست‌وجو در پاسخ‌ها…" aria-label="جست‌وجو در پاسخ‌های آماده" onChange={(event) => setQ(event.target.value)} />
          </label>
          <div className="admReplyList">
            {mine.length ? <h4>پاسخ‌های من</h4> : null}
            {mine.map((item) => (
              <button key={item.id} type="button" role="menuitem" onClick={() => pick(item.body)}><b>{item.title}</b><small>{item.body}</small></button>
            ))}
            {samples.length ? <h4><Sparkles size={13} aria-hidden="true" /> نمونه‌ها</h4> : null}
            {samples.map((item) => (
              <button key={item.title} type="button" role="menuitem" onClick={() => pick(item.body)}><b>{item.title}</b><small>{item.body}</small></button>
            ))}
            {!mine.length && !samples.length ? <p className="admMuted">چیزی پیدا نشد.</p> : null}
          </div>
          <p className="admReplyHint">پاسخ‌های خودت را در «تنظیمات» می‌سازی. <code dir="ltr">{"{name}"}</code> با نام کوچک کاربر پر می‌شود.</p>
        </div>
      ) : null}
    </div>
  );
}
