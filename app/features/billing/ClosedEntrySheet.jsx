"use client";

import { CalendarX } from "lucide-react";
import { Button } from "../../components/ui";
import { ProfileSheet } from "../profile/ProfileSheet";

/**
 * What a salon or artist whose subscription is closed sees on «نوبت تازه», instead of a booking form the server would
 * refuse at the end (owner's decision 2026-11-03: unpaid, no new booking by hand). Says what still works and goes
 * straight to the plans.
 */
export function ClosedEntrySheet({ open, onClose, onPlans }) {
  return (
    <ProfileSheet open={open} kicker="نوبت تازه" title="اشتراکت تموم شده" label="اشتراک تموم شده" panelClassName="billSheet" onClose={onClose}>
      <p className="billSheetLead">
        تا اشتراک نخری، نوبت تازه نمی‌تونی بذاری و لینک نوبتت خاموشه. نوبت‌های قبلیت سر جاشه و می‌تونی جوابشون رو بدی، جابه‌جا یا لغوشون کنی.
      </p>
      <Button block icon={CalendarX} onClick={onPlans}>اشتراک بخر</Button>
      <Button block variant="secondary" onClick={onClose}>باشه</Button>
    </ProfileSheet>
  );
}
