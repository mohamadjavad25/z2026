"use client";

import { AlarmClock } from "lucide-react";
import { formatRequestExpiryDeadline, getRequestExpiryMinutesLeft } from "../../shared/lib/time";

/** A pending request the owner hasn't answered yet has, at most, 60 minutes
 *  before the auto-expiry sweep drops it -- previously nothing on this
 *  card said so, and the only trace was a read-only "expired" line seen
 *  after the fact. */
export function RequestExpiryBadge({ createdAt }) {
  const minutesLeft = getRequestExpiryMinutesLeft(createdAt);
  if (minutesLeft === null) return null;
  const deadline = formatRequestExpiryDeadline(createdAt);
  if (!deadline) return null;
  const urgent = minutesLeft <= 15;
  return (
    <span className={`requestExpiryBadge ${urgent ? "is-urgent" : ""}`}>
      <AlarmClock size={12} aria-hidden="true" />
      {minutesLeft > 0 ? `تا ساعت ${deadline} تایید کن` : "زمان تایید تمام شده"}
    </span>
  );
}
