"use client";

import { Infinity as Always, Timer } from "lucide-react";

/**
 * How long a client's request waits for an answer (user's decision 2026-10-18): two big choices,
 * «تا هر وقت» (until the appointment; the client cancels it if it takes too long) and «فقط ۱ ساعت».
 * With the hour, the salons that could take the same visit instead (`backups`, salons the client
 * follows) show as one row of chips, «نه» first; the line under the hour says what will happen.
 * Used by the salon booking form and the artist booking sheet (no backups there).
 */
export function WaitChoice({ value = "open", onChange, who = "سالن", backups = [], backup = "", onBackup, disabled = false }) {
  const hour = value === "hour";
  const picked = hour && backup ? backups.find((salon) => String(salon.id) === String(backup)) : null;
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
          <div className="wcChips" role="radiogroup" aria-label="سالن دوم">
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
            {backups.map((salon) => {
              const on = Boolean(picked) && String(picked.id) === String(salon.id);
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  key={salon.id}
                  className={`wcChip${on ? " is-on" : ""}`}
                  disabled={disabled}
                  onClick={() => onBackup?.(String(salon.id))}
                >
                  {salon.avatar ? <img src={salon.avatar} alt="" /> : null}
                  <span>{salon.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
