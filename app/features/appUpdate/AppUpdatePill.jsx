"use client";

import { RefreshCw } from "lucide-react";
import { askForAppUpdate } from "../../shared/lib/appUpdate";
import { useAppUpdate } from "./useAppUpdate";

/** The small «به‌روزرسانی» button beside the bell, only while a newer app is live on Cafe Bazaar (owner's choice 2026-10-30). */
export function AppUpdatePill() {
  const { available } = useAppUpdate();
  if (!available) return null;
  return (
    <button type="button" className="appUpdPill" onClick={() => askForAppUpdate()}>
      <RefreshCw size={14} aria-hidden="true" />
      به‌روزرسانی
    </button>
  );
}
