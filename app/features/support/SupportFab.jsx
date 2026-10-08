"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../shared/api/client";
import { SupportCenter } from "./SupportCenter";
import { SupportIcon } from "./SupportIcon";
import { onOpenSupport, onSupportRead } from "./supportEvents";

/**
 * The floating support button (custom icon) for every signed-in role. It sits above the bottom bar where there is one
 * and drops to the bottom where there is not (see support.css). A dot with a number shows replies you have not read.
 */
export function SupportFab() {
  const [open, setOpen] = useState(null); // null = closed, otherwise { ticketId?, view? }
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const { ok, payload } = await apiFetch("/api/support/unread");
    if (ok) setUnread(Number(payload.data?.unread) || 0);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    const offOpen = onOpenSupport((detail) => setOpen(detail));
    const offRead = onSupportRead(refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      offOpen();
      offRead();
    };
  }, [refresh]);

  return (
    <>
      <button
        type="button"
        className={`supportFab${unread ? " has-unread" : ""}`}
        onClick={() => setOpen({})}
        aria-label={unread ? `پشتیبانی، ${unread} پاسخ جدید` : "پشتیبانی"}
      >
        <SupportIcon size={26} />
        {unread ? <i className="supportFabBadge" aria-hidden="true">{String(unread > 9 ? "9+" : unread).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d])}</i> : null}
      </button>
      {open ? <SupportCenter initial={open} onClose={() => { setOpen(null); refresh(); }} /> : null}
    </>
  );
}
