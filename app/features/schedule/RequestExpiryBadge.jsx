"use client";

import { AlarmClock } from "lucide-react";
import { BOOKING_REQUEST_WINDOW_MINUTES, requestDeadlineLabel, requestMinutesLeft } from "../../shared/lib/bookingWindow";

/** A pending request the owner hasn't answered yet has as long as the client chose (`waitMinutes`:
 *  an hour, or null = until the appointment) -- and never past the appointment's own start -- before
 *  the auto-expiry sweep drops it. `day`/`time` are the appointment's, so this label matches what the
 *  sweep really does. A client who waits until the appointment is said so while that is still far. */
export function RequestExpiryBadge({ createdAt, day, time, waitMinutes = BOOKING_REQUEST_WINDOW_MINUTES }) {
  const minutesLeft = requestMinutesLeft(createdAt, day, time, { windowMinutes: waitMinutes });
  const deadline = minutesLeft === null ? "" : requestDeadlineLabel(createdAt, day, time, { windowMinutes: waitMinutes });
  if (waitMinutes === null && (!deadline || minutesLeft > 60)) {
    return (
      <span className="requestExpiryBadge is-calm">
        <AlarmClock size={12} aria-hidden="true" />
        مشتری تا قبل از نوبت صبر می‌کند
      </span>
    );
  }
  if (minutesLeft === null || !deadline) return null;
  const urgent = minutesLeft <= 15;
  return (
    <span className={`requestExpiryBadge ${urgent ? "is-urgent" : ""}`}>
      <AlarmClock size={12} aria-hidden="true" />
      {minutesLeft > 0 ? `تا ساعت ${deadline} تایید کن` : "زمان تایید تمام شده"}
    </span>
  );
}
