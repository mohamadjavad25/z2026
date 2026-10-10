"use client";

import { useState } from "react";
import { ArrowLeft, CalendarCheck, CheckCircle2, Clock3, MapPin, Phone, RotateCcw, TimerOff, XCircle } from "lucide-react";
import { SheetClose } from "../../components/SheetClose";
import { bookingStatusLabel, bookingStatusTone, canClientCancel } from "./bookingStatus";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatRequestExpiryDeadline, minutesToPersianTime, timeLabelToMinutes } from "../../shared/lib/time";
import { bookingTimeOffer } from "../../shared/lib/bookingOffer";
import { formatRelativeBookingDayLabel, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

const BOOKING_STATUS_ICONS = {
  pending: Clock3,
  done: CheckCircle2,
  bad: XCircle,
  expired: TimerOff
};

// "رزرو دوباره" only makes sense once this specific booking is settled —
// cancelled/expired outright, or confirmed and its date has already passed
// (the service actually happened). While it's still pending or confirmed
// for a future date, the client already has an active booking; offering
// "book again" there reads as if nothing was booked at all.
function isBookingSettled(booking) {
  const status = booking?.status || "";
  if (status === "لغو" || status === "منقضی شده") return true;
  if (status !== "تایید شده") return false;
  const rawDate = booking?.booking_date || booking?.date || "";
  if (!rawDate) return false;
  const bookingDate = resolveRollingPersianDate(rawDate);
  const today = resolveRollingPersianDate("امروز");
  return bookingDate.getTime() <= today.getTime();
}

function clockRange(time, minutes) {
  const start = timeLabelToMinutes(time);
  return minutes ? `${minutesToPersianTime(start)} تا ${minutesToPersianTime(start + minutes)}` : minutesToPersianTime(start);
}

/**
 * The salon moved this booking to another time and is waiting for the client's answer:
 * the old and new times side by side, and accept / decline.
 */
function TimeOfferBlock({ booking, offer, onAnswer }) {
  const [answering, setAnswering] = useState("");
  const minutes = Number(booking.duration_minutes) || 0;
  const otherDay = offer.fromDate && offer.fromDate !== offer.toDate;
  const send = async (accept) => {
    setAnswering(accept ? "yes" : "no");
    await onAnswer(booking, accept);
    setAnswering("");
  };
  return (
    <div className="cbOffer" role="group" aria-label="ساعت پیشنهادی تازه">
      <b>سالن ساعت تازه‌ای پیشنهاد داده</b>
      <div className="cbOfferTimes">
        <s aria-label="ساعت قبلی">
          {otherDay ? `${formatRelativeBookingDayLabel(offer.fromDate)} ` : ""}{clockRange(offer.fromTime, minutes)}
        </s>
        <ArrowLeft size={16} aria-hidden="true" />
        <strong aria-label="ساعت تازه">
          {otherDay ? `${formatRelativeBookingDayLabel(offer.toDate)} ` : ""}{clockRange(offer.toTime, minutes)}
        </strong>
      </div>
      <p>اگر رد کنی، درخواستت لغو می‌شود و می‌توانی ساعت دیگری بگیری.</p>
      <div className="cbOfferActions">
        <button type="button" className="is-accept" disabled={Boolean(answering)} onClick={() => send(true)}>
          {answering === "yes" ? "در حال ثبت…" : "قبول ساعت تازه"}
        </button>
        <button type="button" disabled={Boolean(answering)} onClick={() => send(false)}>
          {answering === "no" ? "در حال ثبت…" : "رد"}
        </button>
      </div>
    </div>
  );
}

/**
 * Client role — booking details / quick actions sheet.
 * Presentational: selected booking + call/close callbacks.
 */
export function ClientBookingSettingsModal({
  booking,
  onClose,
  onCallSalon,
  onRebookSalon,
  onCancelBooking,
  onAnswerOffer
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  if (!booking) return null;

  const avatar = booking.salonAvatar || booking.salon_avatar || "";
  const salonName = booking.salonName || booking.salon_name || "سالن منتخب";
  const phone = booking.salonPhone || booking.salon_phone || booking.phone || "";
  const rawDate = booking.booking_date || booking.date || "";
  const formattedDate = rawDate ? formatRelativeBookingDayLabel(rawDate) : "امروز";
  const statusTone = bookingStatusTone(booking.status || "تازه");
  const StatusIcon = BOOKING_STATUS_ICONS[statusTone];
  const area = booking.salonArea || booking.salon_area || "";
  const duration = Number(booking.duration_minutes) || 0;
  const offer = booking.bookingSource === "artist" ? null : bookingTimeOffer(booking);
  const pendingDeadline = statusTone === "pending" && !offer ? formatRequestExpiryDeadline(booking.created_at || booking.createdAt) : "";

  return (
    <div
      className="clientBookingSettingsBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="تنظیمات رزرو"
      onClick={onClose}
    >
      <div className="clientBookingSettingsWrap" onClick={(event) => event.stopPropagation()}>
        <div className="clientBookingSettings">
          <div className="clientBookingSettingsHead">
            <span className={`clientBookingSettingsAvatar ${avatar ? "hasImage" : ""}`} aria-hidden="true">
              {avatar ? <img src={avatar} alt="" /> : String(salonName || "س").slice(0, 1)}
            </span>
            <div>
              <small>جزئیات رزرو</small>
              <b className="svcInline"><ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />{shortServiceLabel(booking.service) || "خدمت زیبایی"}</b>
              <em>{salonName}</em>
            </div>
            <strong className={`clientBookingSettingsStatus is-${statusTone}`}>
              <StatusIcon size={13} />
              {bookingStatusLabel(booking.status)}
            </strong>
          </div>
          <div className="clientBookingSettingsGrid">
            <span>
              <CalendarCheck size={14} /> <b>تاریخ</b>
              <em>{formattedDate}</em>
            </span>
            {booking.time ? (
              <span>
                <Clock3 size={14} /> <b>ساعت</b>
                <em>{toPersianDigits(toLatinDigits(booking.time))}</em>
              </span>
            ) : null}
            {duration ? (
              <span>
                <Clock3 size={14} /> <b>مدت</b>
                <em>{toPersianDigits(duration)} دقیقه</em>
              </span>
            ) : null}
            {area ? (
              <span>
                <MapPin size={14} /> <b>محدوده</b>
                <em>{area}</em>
              </span>
            ) : null}
          </div>
          {offer && onAnswerOffer ? (
            <TimeOfferBlock
              booking={booking}
              offer={offer}
              onAnswer={async (target, accept) => {
                if (await onAnswerOffer(target, accept)) onClose?.();
              }}
            />
          ) : null}
          {pendingDeadline ? (
            <p className="clientBookingPendingNote">
              <Clock3 size={14} />
              سالن تا ساعت {pendingDeadline} پاسخ می‌دهد؛ وگرنه رزرو خودکار لغو می‌شود.
            </p>
          ) : null}
          <div className="clientBookingSettingsActions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (typeof onCallSalon === "function") {
                  onCallSalon(booking);
                  return;
                }
                if (phone) window.location.href = `tel:${toLatinDigits(phone)}`;
              }}
            >
              <Phone size={16} />
              تماس
            </button>
            {isBookingSettled(booking) ? (
              <button type="button" onClick={() => onRebookSalon?.(booking)}>
                <RotateCcw size={16} />
                رزرو دوباره
              </button>
            ) : null}
          </div>
          {canClientCancel(booking) && onCancelBooking && !offer ? (
            confirming ? (
              <div className="cbCancelConfirm" role="alertdialog" aria-label="تأیید لغو رزرو">
                <p>این رزرو لغو شود؟ سالن بلافاصله باخبر می‌شود.</p>
                <div>
                  <button
                    type="button"
                    className="is-danger"
                    disabled={cancelling}
                    onClick={async () => {
                      setCancelling(true);
                      const ok = await onCancelBooking(booking);
                      setCancelling(false);
                      if (ok) {
                        setConfirming(false);
                        onClose?.();
                      }
                    }}
                  >
                    {cancelling ? "در حال لغو…" : "بله، لغو شود"}
                  </button>
                  <button type="button" disabled={cancelling} onClick={() => setConfirming(false)}>نه، نگه دار</button>
                </div>
              </div>
            ) : (
              <button type="button" className="cbCancelBtn" onClick={() => setConfirming(true)}>
                <XCircle size={16} /> لغو رزرو
              </button>
            )
          ) : null}
        </div>
        <SheetClose onClick={onClose} />
      </div>
    </div>
  );
}
