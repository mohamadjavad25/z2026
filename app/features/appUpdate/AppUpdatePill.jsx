"use client";

import { RefreshCw } from "lucide-react";
import { askForAppUpdate } from "../../shared/lib/appUpdate";
import { useAppUpdate } from "./useAppUpdate";

/**
 * The small «به‌روزرسانی» pill beside the bell, only while a newer app is live on Cafe Bazaar (owner's choice 2026-10-30).
 * Not a <button>: the hero's old rules squeeze every button in the corner into a 32–40px circle with !important, which
 * pushed the word off the screen (owner's report 2026-11-01). As a span with the button role it keeps its own pill shape.
 */
export function AppUpdatePill() {
  const { available } = useAppUpdate();
  if (!available) return null;
  const open = () => askForAppUpdate();
  return (
    <span
      role="button"
      tabIndex={0}
      className="appUpdPill"
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      <RefreshCw size={14} aria-hidden="true" />
      به‌روزرسانی
    </span>
  );
}
