"use client";

import { CalendarCheck, MessageCircle } from "lucide-react";

/**
 * Salon client sticky dock CTA.
 * Presentational: open + callbacks from HomeApp.
 */
export function SalonClientFloatingDock({ open = false, onBook, onMessage }) {
  if (!open) return null;

  return (
    <div className="salonClientSticky floatingMobileCtaSplit is-salonClientDock">
      <button type="button" className="ctaSegment ctaGenerate" onClick={onBook}>
        <CalendarCheck size={18} /> رزرو نوبت
      </button>
      <button type="button" className="ctaSegment ctaManage" onClick={onMessage}>
        <MessageCircle size={18} /> پیام به سالن
      </button>
    </div>
  );
}
