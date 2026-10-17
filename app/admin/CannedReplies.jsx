"use client";

import { useEffect, useState } from "react";
import { MessageSquareQuote } from "lucide-react";
import { api } from "./adminFetch";

let cache = null;
/** Forgets the saved replies so the next reply box loads the edited list (called after Settings saves them). */
export function forgetCannedReplies() {
  cache = null;
}

/** The saved answers from Settings as a row of one-tap buttons above a reply box. Renders nothing when there are none. */
export function CannedReplies({ onPick }) {
  const [items, setItems] = useState(cache || []);
  useEffect(() => {
    if (cache) return;
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
  if (!items.length) return null;
  return (
    <div className="admCanned" role="group" aria-label="پاسخ‌های آماده">
      <MessageSquareQuote size={15} aria-hidden="true" />
      {items.map((item) => (
        <button key={item.id} type="button" title={item.body} onClick={() => onPick(item.body)}>{item.title}</button>
      ))}
    </div>
  );
}
