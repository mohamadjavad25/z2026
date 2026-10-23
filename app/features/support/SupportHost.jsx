"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../shared/api/client";
import { SupportCenter } from "./SupportCenter";
import { onOpenSupport, onSupportRead, publishSupportUnread } from "./supportEvents";

/**
 * The one support center for every signed-in role, opened with openSupport() from the small button at the top of the
 * home page (SupportButton) or from «ارتباط با پشتیبانی» in settings. It has no button of its own: the floating one
 * covered dates and buttons (owner's choice 2026-10-23). It also keeps the count of replies not read yet.
 */
export function SupportHost() {
  const [open, setOpen] = useState(null); // null = closed, otherwise { ticketId?, view? }

  const refresh = useCallback(async () => {
    const { ok, payload } = await apiFetch("/api/support/unread");
    if (ok) publishSupportUnread(Number(payload.data?.unread) || 0);
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

  return open ? <SupportCenter initial={open} onClose={() => { setOpen(null); refresh(); }} /> : null;
}
