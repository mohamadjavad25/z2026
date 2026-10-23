"use client";

import { useEffect, useState } from "react";
import { SupportIcon } from "./SupportIcon";
import { onSupportUnread, openSupport, supportUnread } from "./supportEvents";

/** The small support button at the top of the home page, next to the bell; a dot with a number shows unread replies. */
export function SupportButton({ className = "", size = 17 }) {
  const [unread, setUnread] = useState(supportUnread);
  useEffect(() => onSupportUnread(setUnread), []);
  return (
    <button
      type="button"
      className={`supportTopBtn ${className}`.trim()}
      onClick={() => openSupport()}
      aria-label={unread ? `پشتیبانی، ${unread} پاسخ جدید` : "پشتیبانی"}
      title="پشتیبانی"
    >
      <SupportIcon size={size} />
      {unread ? <i className="supportTopBadge" aria-hidden="true">{String(unread > 9 ? "9+" : unread).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d])}</i> : null}
    </button>
  );
}
