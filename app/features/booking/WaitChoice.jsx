"use client";

import { useState } from "react";
import { ChevronDown, Infinity as Always, Timer } from "lucide-react";

/**
 * How long a client's request waits for an answer (user's decision 2026-10-18): two big choices,
 * «تا هر وقت» (until the appointment; the client cancels it if it takes too long) and «فقط ۱ ساعت».
 * With the hour, the salons / artists that could take the same visit instead (`backups`, ones the
 * client follows) show as one row of chips, «نه» first; the line under the hour says what will happen.
 * Folded by default into one quiet row that names the current choice (user's choice 2026-10-23: most
 * clients keep the default, so the question should not stand in the way of «ارسال»); a tap opens it.
 * Used by the salon booking form and the artist booking sheet.
 */
export function WaitChoice({ value = "open", onChange, who = "سالن", backups = [], backup = "", onBackup, disabled = false }) {
  const hour = value === "hour";
  const picked = hour && backup ? backups.find((item) => String(item.id) === String(backup)) : null;
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="wcFold" aria-expanded="false" onClick={() => setOpen(true)}>
        <span>اگر {who} دیر جواب داد: <b>{hour ? "فقط ۱ ساعت صبر" : "صبر می‌کنم"}</b></span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    );
  }
  return (
    <section className="wc" aria-label={`صبر برای جواب ${who}`}>
      <p className="wcTitle">اگر {who} دیر جواب داد؟</p>
      <div className="wcChoices" role="radiogroup" aria-label={`صبر برای جواب ${who}`}>
        <button
          type="button"
          role="radio"
          aria-checked={!hour}
          className={`wcChoice${hour ? "" : " is-on"}`}
          disabled={disabled}
          onClick={() => onChange?.("open")}
        >
          <Always size={20} aria-hidden="true" />
          <b>صبر می‌کنم</b>
          <small>تا هر وقت جواب بدهد</small>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={hour}
          className={`wcChoice${hour ? " is-on" : ""}`}
          disabled={disabled}
          onClick={() => onChange?.("hour")}
        >
          <Timer size={20} aria-hidden="true" />
          <b>فقط ۱ ساعت</b>
          <small>{picked ? `بعد می‌رود برای ${picked.name}` : "بعدش لغو می‌شود"}</small>
        </button>
      </div>
      {hour && backups.length ? (
        <div className="wcBackup">
          <p>اگر جواب نداد، بفرستیم برای:</p>
          <div className="wcChips" role="radiogroup" aria-label={`${who} دوم`}>
            <button
              type="button"
              role="radio"
              aria-checked={!picked}
              className={`wcChip${picked ? "" : " is-on"}`}
              disabled={disabled}
              onClick={() => onBackup?.("")}
            >
              نه، لغو شود
            </button>
            {backups.map((item) => {
              const on = Boolean(picked) && String(picked.id) === String(item.id);
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  key={item.id}
                  className={`wcChip${on ? " is-on" : ""}`}
                  disabled={disabled}
                  onClick={() => onBackup?.(String(item.id))}
                >
                  {item.avatar ? <img src={item.avatar} alt="" /> : null}
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
