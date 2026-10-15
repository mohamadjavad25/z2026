"use client";

import { AlarmClock } from "lucide-react";
import { requestDeadlineLabel, requestMinutesLeft } from "../../shared/lib/bookingWindow";

/** A pending request the owner hasn't answered yet has, at most, 60 minutes -- and never past
 *  the appointment's own start -- before the auto-expiry sweep drops it. `day`/`time` are the
 *  appointment's, so this label matches what the sweep really does. */
export function RequestExpiryBadge({ createdAt, day, time }) {
  const minutesLeft = requestMinutesLeft(createdAt, day, time);
  if (minutesLeft === null) return null;
  const deadline = requestDeadlineLabel(createdAt, day, time);
  if (!deadline) return null;
  const urgent = minutesLeft <= 15;
  return (
    <span className={`requestExpiryBadge ${urgent ? "is-urgent" : ""}`}>
      <AlarmClock size={12} aria-hidden="true" />
      {minutesLeft > 0 ? `تا ساعت ${deadline} تایید کن` : "زمان تایید تمام شده"}
    </span>
  );
}
