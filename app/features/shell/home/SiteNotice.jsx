"use client";

import { useEffect } from "react";
import { notify } from "../../../shared/notice/noticeStore";

const DISMISS_KEY = "frfro-notice-dismissed";

/**
 * The short notice the operator turns on in the admin panel (Settings → «اعلان بالای اپ»). Shown once per edit: closing
 * it remembers that version; editing the text in the panel gives it a new id, so it comes back. `role` is the signed-in
 * user's type (or empty before sign-in); a notice for clients or for salons and artists only reaches them.
 * It shows through the shared top-of-screen stack (app/shared/notice), so it renders nothing itself.
 */
export function SiteNotice({ role = "" }) {
  useEffect(() => {
    let live = true;
    fetch("/api/notice")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const next = payload?.data?.notice;
        if (!live || !next) return;
        const forRole = next.audience === "all" || (next.audience === "client" ? role === "client" : role === "artist" || role === "salon");
        if (!forRole) return;
        let dismissed = "";
        try {
          dismissed = window.localStorage.getItem(DISMISS_KEY) || "";
        } catch {
          // storage can be blocked; then it simply shows each visit
        }
        if (dismissed === String(next.id)) return;
        notify({
          id: `site-notice-${next.id}`,
          kind: "note",
          tone: next.tone || "info",
          title: next.text,
          link: next.link,
          linkLabel: next.linkLabel,
          onClose: () => {
            try {
              window.localStorage.setItem(DISMISS_KEY, String(next.id));
            } catch {
              // not essential
            }
          }
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [role]);

  return null;
}
