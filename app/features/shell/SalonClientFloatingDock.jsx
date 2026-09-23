"use client";

import { CalendarCheck } from "lucide-react";

/**
 * Salon client sticky dock CTA.
 * Presentational: open + callback from HomeApp.
 */
export function SalonClientFloatingDock({ open = false, onBook }) {
  if (!open) return null;

  return (
    <div className="salonClientSticky floatingMobileCtaSplit is-salonClientDock">
      <button type="button" className="ctaSegment ctaGenerate" onClick={onBook}>
        <CalendarCheck size={18} /> رزرو نوبت
      </button>
    </div>
  );
}
