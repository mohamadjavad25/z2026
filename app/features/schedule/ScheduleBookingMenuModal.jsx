"use client";

import { useEffect, useState } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import {
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Phone,
  Scissors,
  Timer,
  TimerOff,
  Trash2,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import { getBookingDateOffsetDays, getBookingTimelinePhase } from "../artist/bookingUtils";
import { isPersianDateKey } from "../../shared/lib/persianCalendar";
import { SegmentClock } from "../../components/SegmentClock";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatRequestExpiryDeadline, getRequestExpiryMinutesLeft } from "../../shared/lib/time";
import { isMultiPartBooking, parseBookingParts } from "../../shared/lib/bookingParts";
import { BookingPartsEditor } from "./BookingPartsEditor";
import { AWAITING_CLIENT, bookingTimeOffer } from "../../shared/lib/bookingOffer";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

// Shown when a customer / staff member / source has no uploaded photo.
const DEFAULT_AVATAR = "/profile-icon.svg";

// ownerType-aware status-tone mapping — same convention as
// ScheduleRow.jsx's getBookingStatusTone (duplicated on purpose per this
// codebase's convention for small component-local helpers; see that file
// for why "تازه" needs to resolve differently for salon vs artist
// bookings). This modal is shared by the salon AND artist owner schedule
// views, and used to always render booking.status in one fixed green pill
// no matter what the real status was (so a cancelled or expired booking
// looked identical to a confirmed one).
function getBookingStatusTone(status = "", ownerType = "salon") {
  if (status === "تایید" || status === "تایید شده") return "done";
  if (status === "لغو") return "bad";
  if (status === "منقضی شده") return "expired";
  if (status === "درخواست") return "pending";
  if (status === "تازه") return ownerType === "artist" ? "pending" : "done";
  return "pending";
}

// A booking is "past" once its day is behind us, or it is today and its
// time slot has already ended. Past bookings are review-only.
function isBookingInPast(booking) {
  const date = String(booking?.source?.booking_date || booking?.booking_date || booking?.date || "").trim();
  if (booking?.phase === "done") return true;
  if (isPersianDateKey(date)) {
    const offset = getBookingDateOffsetDays(date);
    if (offset < 0) return true;
    if (offset > 0) return false;
  }
  return getBookingTimelinePhase(
    { date: isPersianDateKey(date) ? "امروز" : date, time: booking?.time },
    { durationMinutes: booking?.durationMinutes }
  ) === "done";
}

const BOOKING_STATUS_ICONS = {
  pending: Clock3,
  done: CheckCircle2,
  bad: XCircle,
  expired: TimerOff
};

/**
 * Shared salon+artist schedule booking settings modal.
 * Presentational: booking/view + onChangeTime/Staff/Cancel/Close from HomeApp.
 * Does NOT own schedule triad state.
 */
export function ScheduleBookingMenuModal({
  open,
  booking,
  view = "menu",
  onViewChange,
  timeSlots = [],
  staffOptions = [],
  onClose,
  onChangeTime,
  onChangeStaff,
  onChangeParts,
  onCancel,
  onApprove,
  onDecline,
  busy = false
}) {
  // The artist picker opens inline; reset per booking because this modal
  // instance is reused rather than remounted per booking.
  const [artistPickerOpen, setArtistPickerOpen] = useState(false);
  useEffect(() => {
    setArtistPickerOpen(false);
  }, [booking?.id]);

  if (!open || !booking) return null;

  const isSalonOwner = booking.ownerType === "salon";
  // Same "not yet reviewed" definition ScheduleRow.jsx/getBookingStatusTone
  // above use — "درخواست" for either role, "تازه" only counts as pending for
  // an artist (a salon's own "تازه" walk-in entry is already settled). This
  // is the one entry point that previously had zero approve/decline action —
  // the client's booking might sit here forever without a next step visible.
  const isPendingReview = booking.status === "درخواست" || (!isSalonOwner && booking.status === "تازه");
  const sourceSalon = booking.sourceSalon || {};
  // Always show a logo: the uploaded photo when there is one, else the app's default profile icon.
  const avatar = booking.clientAvatar || booking.client_avatar || sourceSalon.avatar || DEFAULT_AVATAR;
  const title = booking.client || booking.salonName || sourceSalon.name || "رزرو";
  const multiPart = isSalonOwner && isMultiPartBooking(booking);
  const partStaff = multiPart ? [...new Set(parseBookingParts(booking.parts).map((part) => part.staff).filter(Boolean))] : [];
  const subtitle = multiPart
    ? `${toPersianDigits(parseBookingParts(booking.parts).length)} خدمت · ${partStaff.length ? partStaff.join(" و ") : "آرتیست ثبت نشده"}`
    : isSalonOwner
    ? (booking.staff || "آرتیست ثبت نشده")
    : (sourceSalon.name || booking.staff || "رزرو شخصی");
  const phone = booking.phone || booking.clientPhone || booking.client_phone || "";
  const currentArtistAvatar = isSalonOwner
    ? (booking.staffAvatar || staffOptions.find((person) => person.name === booking.staff)?.avatar || DEFAULT_AVATAR)
    : (sourceSalon.avatar || DEFAULT_AVATAR);
  const slots = timeSlots.length ? timeSlots : [booking.time].filter(Boolean);
  const actionDisabled = Boolean(busy);
  // booking.ownerType isn't set on every path (e.g. raw history-sheet items
  // in ArtistScheduleBoard/SalonScheduleDashboard don't carry it) — reuse
  // isSalonOwner, the same fallback this component already relies on
  // everywhere else, instead of trusting the raw field directly.
  const isPast = isBookingInPast(booking);
  const isCancelled = booking.status === "لغو" || booking.status === "منقضی شده";
  // Past or settled bookings can be reviewed, never edited.
  const readOnly = isPast || isCancelled;
  const canManage = isSalonOwner && !readOnly;
  const statusTone = getBookingStatusTone(booking.status || "درخواست", isSalonOwner ? "salon" : "artist");
  const StatusIcon = BOOKING_STATUS_ICONS[statusTone];

  return (
    <div
      className="clientBookingSettingsBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="تنظیمات رزرو"
      onClick={onClose}
    >
      <div className="clientBookingSettingsWrap" onClick={(event) => event.stopPropagation()}>
        <div className="clientBookingSettings scheduleBookingSettings">
          <div className="clientBookingSettingsHead">
            <span className="clientBookingSettingsAvatar hasImage" aria-hidden="true">
              <img src={avatar} alt="" />
            </span>
            <div>
              <small>
                {view === "time" ? "تغییر ساعت" : readOnly ? "جزئیات رزرو • فقط مشاهده" : "جزئیات رزرو"}
              </small>
              <b>{title}</b>
              <em>{subtitle}</em>
            </div>
            <strong className={`clientBookingSettingsStatus is-${statusTone}`}>
              <StatusIcon size={13} />
              {booking.status || "درخواست"}
            </strong>
          </div>

          <div className="clientBookingSettingsTime">
            <SegmentClock value={booking.time || "زمان"} size="sm" as="span" backgroundColor="transparent" />
          </div>

          {view === "menu" ? (
            <>
              <div className="scheduleBookingDetails">
                <div className="scheduleBookingDetail">
                  <CalendarCheck size={15} aria-hidden="true" />
                  <span>تاریخ</span>
                  <b>{booking.booking_date || booking.date || "امروز"}</b>
                </div>
                <div className="scheduleBookingDetail">
                  <Scissors size={15} aria-hidden="true" />
                  <span>خدمت</span>
                  <b className="svcInline"><ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />{shortServiceLabel(booking.service) || "خدمت زیبایی"}</b>
                </div>
                {phone ? (
                  <div className="scheduleBookingDetail">
                    <Phone size={15} aria-hidden="true" />
                    <span>تماس</span>
                    <b dir="ltr">{toPersianDigits(phone)}</b>
                  </div>
                ) : null}
              </div>

              {multiPart ? (
                <BookingPartsEditor
                  booking={booking}
                  staffOptions={staffOptions}
                  disabled={!canManage || actionDisabled}
                  onChange={onChangeParts}
                />
              ) : (
              <div className={`scheduleBookingArtist ${artistPickerOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="scheduleBookingArtistCurrent"
                  disabled={!canManage || actionDisabled}
                  aria-expanded={canManage ? artistPickerOpen : undefined}
                  aria-haspopup={canManage ? "listbox" : undefined}
                  onClick={() => canManage && setArtistPickerOpen((open) => !open)}
                >
                  <span className="scheduleStaffAvatar hasImage" aria-hidden="true">
                    <img src={currentArtistAvatar} alt="" />
                  </span>
                  <span className="scheduleBookingArtistCopy">
                    <small>{isSalonOwner ? "آرتیست" : "منبع"}</small>
                    <b>{subtitle}</b>
                  </span>
                  {canManage ? <ChevronDown size={16} className="scheduleBookingArtistChevron" aria-hidden="true" /> : null}
                </button>
                {canManage && artistPickerOpen ? (
                  <div className="scheduleBookingArtistList" role="listbox" aria-label="انتخاب آرتیست">
                    {staffOptions.map((person) => {
                      const personAvatar = person.avatar || person.staff_avatar || "";
                      const active = person.name === booking.staff;
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          key={person.id || person.name}
                          className={active ? "is-selected" : ""}
                          disabled={actionDisabled}
                          onClick={() => {
                            if (active) {
                              setArtistPickerOpen(false);
                              return;
                            }
                            onChangeStaff?.(person.name);
                          }}
                        >
                          <span className={`scheduleStaffAvatar ${personAvatar ? "hasImage" : ""}`} aria-hidden="true">
                            {personAvatar ? <img src={personAvatar} alt="" /> : String(person.artist_name || person.name || "آ").slice(0, 1)}
                          </span>
                          <span className="scheduleBookingStaffCopy">
                            <b>{person.artist_name || person.name}</b>
                            <small>{person.role || person.artist_service || "آرتیست"}{person.artist_area ? ` • ${person.artist_area}` : ""}</small>
                          </span>
                          {active ? <Check size={16} /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              )}

              {isPendingReview && !readOnly ? (
                <div className="scheduleBookingReviewActions">
                  {(() => {
                    const createdAt = booking.createdAt || booking.created_at || "";
                    const minutesLeft = getRequestExpiryMinutesLeft(createdAt);
                    const deadline = formatRequestExpiryDeadline(createdAt);
                    if (minutesLeft === null || !deadline) return null;
                    return (
                      <span className={`requestExpiryBadge ${minutesLeft <= 15 ? "is-urgent" : ""}`}>
                        <Timer size={12} aria-hidden="true" />
                        {minutesLeft > 0 ? `تا ساعت ${deadline} تایید کن` : "زمان تایید تمام شده"}
                      </span>
                    );
                  })()}
                  <button type="button" className="is-approve" disabled={actionDisabled} onClick={onApprove}>
                    <Check size={16} />
                    {busy ? "در حال…" : "تایید نوبت"}
                  </button>
                  <button type="button" className="is-decline" disabled={actionDisabled} onClick={onDecline}>
                    <X size={16} />
                    رد کردن
                  </button>
                </div>
              ) : null}

              {isSalonOwner && !readOnly && bookingTimeOffer(booking) ? (
                <p className="scheduleBookingReadOnlyNote is-offer">
                  <Timer size={14} aria-hidden="true" />
                  ساعت تازه برای مشتری فرستاده شد (قبلاً {toPersianDigits(bookingTimeOffer(booking).fromTime)})؛ تا قبول یا رد کند، «{AWAITING_CLIENT}» می‌ماند.
                </p>
              ) : null}

              {readOnly ? (
                <p className="scheduleBookingReadOnlyNote">
                  <Eye size={14} aria-hidden="true" />
                  این رزرو گذشته است و فقط قابل مشاهده است.
                </p>
              ) : null}

              <div className="scheduleBookingActionRow">
                {canManage ? (
                  <button type="button" className="is-time" disabled={actionDisabled} onClick={() => onViewChange?.("time")}>
                    <Timer size={16} />
                    تغییر ساعت
                  </button>
                ) : null}
                <button
                  type="button"
                  className="is-icon"
                  disabled={!phone}
                  aria-label="تماس با مشتری"
                  title="تماس"
                  onClick={() => {
                    if (phone) window.location.href = `tel:${toLatinDigits(phone)}`;
                  }}
                >
                  <Phone size={17} />
                </button>
                {canManage ? (
                  <button
                    type="button"
                    className="is-icon is-danger"
                    disabled={actionDisabled}
                    aria-label="حذف رزرو"
                    title="حذف رزرو"
                    onClick={() => {
                      if (typeof window !== "undefined" && !window.confirm("این رزرو لغو شود؟")) return;
                      onCancel?.();
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {view === "time" ? (
            <div className="scheduleBookingPickList">
              <button type="button" className="scheduleBookingBack" disabled={actionDisabled} onClick={() => onViewChange?.("menu")}>
                بازگشت
              </button>
              {isSalonOwner && (booking.client_user_id || booking.clientUserId) ? (
                <p className="scheduleBookingReadOnlyNote is-offer">ساعت تازه برای مشتری فرستاده می‌شود تا قبول یا رد کند.</p>
              ) : null}
              {slots.map((slot) => {
                const active = slot === booking.time;
                return (
                  <button
                    type="button"
                    key={slot}
                    className={active ? "is-selected" : ""}
                    disabled={actionDisabled}
                    onClick={() => onChangeTime?.(slot)}
                  >
                    <SegmentClock value={slot} size="xs" as="span" />
                    {active ? <Check size={16} /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

        </div>
        <button type="button" className="clientBookingSettingsClose" onClick={onClose} aria-label="بستن تنظیمات رزرو">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
