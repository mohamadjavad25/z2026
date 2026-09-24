"use client";

import { CalendarCheck, CheckCircle2, Phone, UserRound, X } from "lucide-react";
import { BreakTimeWheel } from "../../components/BreakTimeWheel";
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
    <div
      className="salonClientBookingModal"
      role="dialog"
      aria-modal="true"
      aria-label="ثبت رزرو سالن"
      onClick={onClose}
    >
      <div className="salonClientBookingPanel" onClick={(event) => event.stopPropagation()}>
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
          <div>
            <strong>{booking.service}</strong>
            <small>{salon.name}</small>
          </div>
          <button type="button" className="salonClientBookingClose" onClick={onClose} aria-label="بستن">
            <X size={16} />
          </button>
        </div>

        <div className="salonClientBookingWheelPair">
          <div className="bookingDayPicker">
            <BreakTimeWheel
              mode="label"
              idPrefix="salon-client-booking-day"
              visibleCount={5}
              options={salonClientBookingDays}
              value={booking.day}
              onChange={(day) => onChange({ day })}
              ariaLabel="انتخاب روز رزرو سالن"
            />
          </div>
          <div className="bookingTimePicker">
            {freeTimes.length ? (
              <BreakTimeWheel
                mode="clock"
                idPrefix="salon-client-booking-time"
                visibleCount={5}
                options={freeTimes}
                value={booking.time}
                onChange={(time) => onChange({ time })}
                ariaLabel="انتخاب ساعت رزرو سالن"
              />
            ) : (
              <div className="artistPublicSlotEmpty">برای این روز ساعتی آزاد نیست.</div>
            )}
          </div>
        </div>

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
      </div>
    </div>
  );
}
