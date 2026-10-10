"use client";

import { CalendarCheck, Phone, UserRound } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { BookingSlotPicker } from "../../components/BookingSlotPicker";
import { ProfileSheet } from "../profile/ProfileSheet";
import { salonClientBookingDays } from "../artist/constants";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { minutesToPersianTime, parseServiceDurationMinutes, timeLabelToMinutes } from "../../shared/lib/time";

// The salon's hours rows are keyed by the Persian weekday name; a day label looks like "یکشنبه ۱۲ مهر".
function getClosedDayLabels(hours, dayLabels) {
  if (!Array.isArray(hours) || !hours.length) return [];
  return dayLabels.filter((label) => {
    const row = hours.find((item) => item.day === String(label).split(" ")[0]);
    return row && !row.active;
  });
}

export function SalonClientBookingModal({
  open,
  salon,
  booking,
  freeTimes,
  timesLoading = false,
  busy,
  onClose,
  onChange,
  onConfirm,
  onEditProfile
}) {
  if (!open || !salon) return null;

  const serviceItem = (booking.bundle?.name === booking.service ? booking.bundle : null)
    || (Array.isArray(salon.services) ? salon.services : []).find((item) => item.name === booking.service);
  const serviceEmoji = serviceItem?.emoji || "";
  const price = parseTomanAmount(serviceItem?.price);
  // Several services in one visit, back to back: say until when, and how the times were picked.
  const visitCount = booking.bundle?.name === booking.service ? booking.bundle.items.length : 0;
  const visitEnd = visitCount && booking.time
    ? minutesToPersianTime(timeLabelToMinutes(booking.time) + parseServiceDurationMinutes(serviceItem?.duration))
    : "";
  const summaryParts = [
    booking.day,
    booking.time
      ? `ساعت ${toPersianDigits(toLatinDigits(booking.time))}${visitEnd ? ` تا حدود ${visitEnd}` : ""}`
      : "",
    serviceItem?.duration ? toPersianDigits(serviceItem.duration) : "",
    price ? `${formatTomanNumber(price)} تومان` : ""
  ].filter(Boolean);
  const closedDays = getClosedDayLabels(salon.hours, salonClientBookingDays);
  const profileName = booking.client || "مشتری frfro";
  const hasPhone = Boolean(booking.phone);
  const profilePhone = booking.phone ? toPersianDigits(toLatinDigits(booking.phone)) : "شماره تماس ثبت نشده";
  const canSubmit = Boolean(freeTimes.length && !timesLoading && !busy && hasPhone);

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
          <ServiceIcon emoji={serviceEmoji} name={visitCount ? booking.bundle.items[0]?.name : booking.service} size="md" />
          <div className="salonClientBookingTitle">
            <strong>{visitCount ? `${toPersianDigits(visitCount)} خدمت` : booking.service}</strong>
            <small>{salon.name}</small>
          </div>
        </div>

        {visitCount ? (
          <ul className="salonClientVisitChips" aria-label="خدمات این نوبت">
            {booking.bundle.items.map((item) => (
              <li key={item.id || item.name}>
                <ServiceIcon emoji={item.emoji} name={item.name} size="xs" />
                <span>{item.name}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <BookingSlotPicker
          dayOptions={salonClientBookingDays}
          closedDays={closedDays}
          dayValue={booking.day}
          onDayChange={(day) => onChange({ day })}
          timeOptions={freeTimes}
          timeValue={booking.time}
          onTimeChange={(time) => onChange({ time })}
          emptyTimeMessage={timesLoading
            ? "در حال پیدا کردن ساعت‌های آزاد…"
            : visitCount
              ? "این روز ساعتی نیست که همهٔ این خدمات پشت سر هم جا شوند. روز دیگری را انتخاب کن."
              : "برای این روز ساعتی آزاد نیست. روز دیگری را انتخاب کن."}
        />

        {visitCount ? (
          <p className="salonClientVisitNote">
            {toPersianDigits(visitCount)} خدمت پشت سر هم انجام می‌شوند؛ فقط ساعت‌هایی آمده که برای همه‌شان آرتیست آزاد هست. اگر سالن ساعت را عوض کند، اول از تو می‌پرسد.
          </p>
        ) : null}

        {booking.time ? (
          <p className="salonClientBookingSummary" aria-live="polite">{summaryParts.join(" • ")}</p>
        ) : null}

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
