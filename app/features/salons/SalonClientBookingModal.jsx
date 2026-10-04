"use client";

import { CalendarCheck, Phone, UserRound } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { BookingSlotPicker } from "../../components/BookingSlotPicker";
import { ProfileSheet } from "../profile/ProfileSheet";
import { salonClientBookingDays } from "../artist/constants";

export function SalonClientBookingModal({
  open,
  salon,
  booking,
  freeTimes,
  busy,
  onClose,
  onChange,
  onConfirm,
  onEditProfile
}) {
  if (!open || !salon) return null;

  const serviceEmoji = (Array.isArray(salon.services) ? salon.services : [])
    .find((item) => item.name === booking.service)?.emoji || "";
  const profileName = booking.client || "مشتری زیبابان";
  const hasPhone = Boolean(booking.phone);
  const profilePhone = booking.phone || "شماره تماس ثبت نشده";
  const canSubmit = Boolean(freeTimes.length && !busy && hasPhone);

  return (
    <ProfileSheet
      open={open}
      label="ثبت رزرو سالن"
      panelClassName="salonClientBookingPanel"
      hideHeader
      onClose={onClose}
    >
        <div className="salonClientBookingHead">
          <span className="salonClientBookingBadge">
            <CalendarCheck size={14} />
            {booking.day}
          </span>
          <ServiceIcon emoji={serviceEmoji} name={booking.service} size="md" />
          <div>
            <strong>{booking.service}</strong>
            <small>{salon.name}</small>
          </div>
        </div>

        <BookingSlotPicker
          dayOptions={salonClientBookingDays}
          dayValue={booking.day}
          onDayChange={(day) => onChange({ day })}
          timeOptions={freeTimes}
          timeValue={booking.time}
          onTimeChange={(time) => onChange({ time })}
          emptyTimeMessage="برای این روز ساعتی آزاد نیست. روز دیگری را انتخاب کن."
        />

        <div className="salonClientBookingProfile">
          <div className="salonClientBookingProfileHead">
            <span>اطلاعات تماس</span>
            <small>سالن با همین شماره برای تأیید با تو هماهنگ می‌کند.</small>
          </div>
          <div className="salonClientBookingProfileGrid">
            <span>
              <UserRound size={15} />
              <small>نام</small>
              <b>{profileName}</b>
            </span>
            <span>
              <Phone size={15} />
              <small>شماره تماس</small>
              <b dir="ltr">{profilePhone}</b>
            </span>
          </div>
          {!hasPhone ? (
            <p className="salonClientBookingPhoneWarning">
              برای رزرو، شماره تماس را در پروفایلت ثبت کن.{" "}
              {typeof onEditProfile === "function" ? (
                <button type="button" onClick={onEditProfile}>
                  ثبت شماره تماس
                </button>
              ) : null}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="salonClientBookingSubmit"
          disabled={!canSubmit}
          onClick={() => onConfirm({ profileConfirmed: true })}
        >
          <CalendarCheck size={17} />
          {busy ? "در حال ثبت..." : "ثبت درخواست نوبت"}
        </button>
    </ProfileSheet>
  );
}
