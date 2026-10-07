"use client";

import { ProfileSheet } from "./ProfileSheet";

export function BookingSheet({
  open,
  role = "salon",
  title = "ایجاد رزرو",
  onClose,
  children
}) {
  return (
    <ProfileSheet
      open={open}
      kicker=""
      title={title}
      label={title}
      panelClassName={`bookingSheet ${role === "artist" ? "is-artist" : "is-salon"}`}
      onClose={onClose}
    >
      <div className="bookingSheetBody">
        {children}
      </div>
    </ProfileSheet>
  );
}
