"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";

const DISMISS_KEY = "frfro-notice-dismissed";
const ICON = { info: Info, success: CircleCheck, warning: TriangleAlert };

/**
 * The short notice the operator turns on in the admin panel (Settings → «اعلان بالای اپ»). Shown once per edit: closing
 * it remembers that version; editing the text in the panel gives it a new id, so it comes back. `role` is the signed-in
 * user's type (or empty before sign-in); a notice for clients or for salons and artists only reaches them.
 */
export function SiteNotice({ role = "" }) {
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    let live = true;
    fetch("/api/notice")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const next = payload?.data?.notice;
        if (!live || !next) return;
        let dismissed = "";
        try {
          dismissed = window.localStorage.getItem(DISMISS_KEY) || "";
        } catch {
          // storage can be blocked; then it simply shows each visit
        }
        if (dismissed !== String(next.id)) setNotice(next);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!notice) return null;
  const forRole = notice.audience === "all" || (notice.audience === "client" ? role === "client" : role === "artist" || role === "salon");
  if (!forRole) return null;

  function close() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(notice.id));
    } catch {
      // not essential
    }
    setNotice(null);
  }
  const Icon = ICON[notice.tone] || Info;
  const external = notice.link.startsWith("https://");
  return (
    <div className={`siteNotice is-${notice.tone}`} role="status" aria-live="polite">
      <Icon size={18} aria-hidden="true" />
      <p>
        {notice.text}
        {notice.link && notice.linkLabel ? (
          <> <a href={notice.link} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{notice.linkLabel}</a></>
        ) : null}
      </p>
      <button type="button" aria-label="بستن اعلان" onClick={close}><X size={16} aria-hidden="true" /></button>
    </div>
  );
}
