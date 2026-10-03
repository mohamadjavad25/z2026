"use client";

import { CalendarCheck, CheckCircle2, Phone, UserRound, X } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { DateTimeWheelPicker } from "../../components/DateTimeWheelPicker";
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
  const selectedDayIndex = Math.max(0, salonClientBookingDays.indexOf(booking.day));
  const canSubmit = Boolean(freeTimes.length && !busy && hasPhone);

  function selectNextDay() {
    const nextIndex = (selectedDayIndex + 1) % salonClientBookingDays.length;
    onChange({ day: salonClientBookingDays[nextIndex] });
  }

  return (
    <ProfileSheet
      open={open}
      label="ثبت رزرو سالن"
      panelClassName="salonClientBookingPanel"
      hideHeader
      onClose={onClose}
    >
        <div className="salonClientBookingHead">
          <button
            type="button"
            className="salonClientBookingBadge"
            onClick={selectNextDay}
            aria-label={`تغییر تاریخ رزرو، تاریخ فعلی ${booking.day}`}
          >
            <CalendarCheck size={14} />
            {booking.day}
          </button>
          <ServiceIcon emoji={serviceEmoji} name={booking.service} size="md" />
          <div>
            <strong>{booking.service}</strong>
            <small>{salon.name}</small>
          </div>
          <button type="button" className="salonClientBookingClose" onClick={onClose} aria-label="بستن">
            <X size={16} />
          </button>
        </div>

        <DateTimeWheelPicker
          dayOptions={salonClientBookingDays}
          dayValue={booking.day}
          onDayChange={(day) => onChange({ day })}
          dayIdPrefix="salon-client-booking-day"
          dayAriaLabel="انتخاب روز رزرو سالن"
          timeOptions={freeTimes}
          timeValue={booking.time}
          onTimeChange={(time) => onChange({ time })}
          timeIdPrefix="salon-client-booking-time"
          timeAriaLabel="انتخاب ساعت رزرو سالن"
          emptyTimeMessage="برای این روز ساعتی آزاد نیست."
        />

        <div className="salonClientBookingProfile">
          <div className="salonClientBookingProfileHead">
            <span>اطلاعات رزرو از پروفایل</span>
            <small>قبل از ارسال، اطلاعاتت را تایید کن.</small>
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
          <label className={`salonClientBookingConfirm ${booking.profileConfirmed ? "is-confirmed" : ""}`}>
            <input
              type="checkbox"
              checked={Boolean(booking.profileConfirmed)}
              onChange={(event) => onChange({ profileConfirmed: event.target.checked })}
            />
            <span aria-hidden="true">
              <CheckCircle2 size={17} />
            </span>
            <b>اطلاعات پروفایل را تایید می‌کنم</b>
          </label>
        </div>

        <button
          type="button"
          className="salonClientBookingSubmit"
          disabled={!canSubmit}
          onClick={() => onConfirm({ profileConfirmed: true })}
        >
          <CalendarCheck size={17} />
          {busy ? "در حال ثبت..." : booking.profileConfirmed ? "رزرو نوبت" : "تایید اطلاعات و رزرو"}
        </button>
    </ProfileSheet>
  );
}
