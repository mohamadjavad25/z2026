"use client";

import { hasBookingStarted } from "./bookingStatus";

export const ASK_SOMEONE_ELSE = "frfro:ask-someone-else";

/**
 * Under a request the salon or artist said no to («انجام نمی‌دم» / «رد»), while its time is still ahead (owner,
 * 2026-11-12): the same service, day and hour go to someone else. The connect card on the client's home opens the
 * request at «کجا بری؟» (ConnectPage listens for ASK_SOMEONE_ELSE).
 */
export function AskSomeoneElse({ booking }) {
  if (!booking || booking.status !== "لغو" || booking.cancelled_by !== "provider" || booking.parts) return null;
  if (hasBookingStarted(booking)) return null;
  const date = booking.booking_date || booking.date || "";
  if (!date || !booking.time) return null;
  const ask = () => window.dispatchEvent(new CustomEvent(ASK_SOMEONE_ELSE, {
    detail: { name: String(booking.service || "").trim(), icon: booking.service_emoji || "", date, time: booking.time }
  }));
  return (
    <div className="erActions">
      <button type="button" className="erPrimary" onClick={ask}>برای یکی دیگه بفرست</button>
    </div>
  );
}
