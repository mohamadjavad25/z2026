"use client";

import { BellRing } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";

/**
 * Requests still waiting for an answer on days other than the one on screen. Their approve / decline
 * sits on their own booking card, so this only says which days have them and jumps there.
 * `requests`: [{ id, dateKey }]; `visibleIds`: the ids already shown on the selected day.
 */
export function PendingOtherDays({ requests = [], visibleIds = [], onSelectDay }) {
  const shown = new Set(visibleIds.map(String));
  const byDay = new Map();
  for (const request of requests) {
    if (shown.has(String(request.id)) || !request.dateKey) continue;
    byDay.set(request.dateKey, (byDay.get(request.dateKey) || 0) + 1);
  }
  if (!byDay.size) return null;
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const total = days.reduce((sum, [, count]) => sum + count, 0);
  return (
    <div className="pendingOtherDays" role="group" aria-label="درخواست‌های روزهای دیگر">
      <span className="pendingOtherDaysTitle">
        <BellRing size={14} aria-hidden="true" />
        {toPersianDigits(total)} درخواست در روزهای دیگر
      </span>
      <span className="pendingOtherDaysList">
        {days.map(([dateKey, count]) => (
          <button type="button" key={dateKey} onClick={() => onSelectDay?.(dateKey)}>
            {formatRelativeBookingDayLabel(dateKey)}
            <b>{toPersianDigits(count)}</b>
          </button>
        ))}
      </span>
    </div>
  );
}
