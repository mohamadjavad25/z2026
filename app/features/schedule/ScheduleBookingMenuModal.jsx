"use client";

import {
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock3,
  History,
  Phone,
  Scissors,
  Timer,
  TimerOff,
  Trash2,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";

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
  clientProfile = null,
  view = "menu",
  onViewChange,
  timeSlots = [],
  staffOptions = [],
  onClose,
  onChangeTime,
  onChangeStaff,
  onCancel,
  onApprove,
  onDecline,
  busy = false
}) {
  if (!open || !booking) return null;

  const isSalonOwner = booking.ownerType === "salon";
  // Same "not yet reviewed" definition ScheduleRow.jsx/getBookingStatusTone
  // above use — "درخواست" for either role, "تازه" only counts as pending for
  // an artist (a salon's own "تازه" walk-in entry is already settled). This
  // is the one entry point that previously had zero approve/decline action —
  // the client's booking might sit here forever without a next step visible.
  const isPendingReview = booking.status === "درخواست" || (!isSalonOwner && booking.status === "تازه");
  const sourceSalon = booking.sourceSalon || {};
  const avatar = booking.clientAvatar || booking.client_avatar || sourceSalon.avatar || "";
  const title = booking.client || booking.salonName || sourceSalon.name || "رزرو";
  const subtitle = isSalonOwner
    ? (booking.staff || "آرتیست ثبت نشده")
    : (sourceSalon.name || booking.staff || "رزرو شخصی");
  const phone = booking.phone || booking.clientPhone || booking.client_phone || "";
  const slots = timeSlots.length ? timeSlots : [booking.time].filter(Boolean);
  const actionDisabled = Boolean(busy);
  // booking.ownerType isn't set on every path (e.g. raw history-sheet items
  // in ArtistScheduleBoard/SalonScheduleDashboard don't carry it) — reuse
  // isSalonOwner, the same fallback this component already relies on
  // everywhere else, instead of trusting the raw field directly.
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
            <span className={`clientBookingSettingsAvatar ${avatar ? "hasImage" : ""}`} aria-hidden="true">
              {avatar ? <img src={avatar} alt="" /> : String(title || "ر").slice(0, 1)}
            </span>
            <div>
              <small>
                {view === "time"
                  ? "تغییر ساعت"
                  : view === "staff"
                    ? "تغییر آرتیست"
                    : "تنظیمات رزرو"}
              </small>
              <b>{title}</b>
              <em>{subtitle}</em>
            </div>
            {clientProfile ? (
              <button
                type="button"
                className="scheduleBookingHistoryIcon"
                aria-label="تاریخچه خدمات مشتری"
                title="تاریخچه خدمات"
              >
                <History size={17} />
              </button>
            ) : null}
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
              <div className="clientBookingSettingsGrid scheduleBookingSettingsGrid">
                <span><CalendarCheck size={14} /> <b>تاریخ</b><em>{booking.booking_date || booking.date || "امروز"}</em></span>
                <span><Scissors size={14} /> <b>خدمت</b><em>{booking.service || "خدمت زیبایی"}</em></span>
                <span><UserRound size={14} /> <b>{isSalonOwner ? "آرتیست" : "منبع"}</b><em>{subtitle}</em></span>
              </div>
              {clientProfile ? (
                <div className="scheduleBookingClientPanel" aria-label="پروفایل مشتری">
                  <div className="scheduleBookingClientHead">
                    <span className={`scheduleBookingClientAvatar ${clientProfile.avatar ? "hasImage" : ""}`} aria-hidden="true">
                      {clientProfile.avatar ? <img src={clientProfile.avatar} alt="" /> : String(clientProfile.name || "م").slice(0, 1)}
                    </span>
                    <span>
                      <small>پروفایل مشتری</small>
                      <b>{clientProfile.name}</b>
                      <em>{clientProfile.area || "ایران"}</em>
                    </span>
                  </div>
                  <div className="scheduleBookingClientStats">
                    <span><b>{toPersianDigits(clientProfile.bookingCount || 1)}</b><em>نوبت</em></span>
                    <span><b>{clientProfile.lastBooking?.service || booking.service || "—"}</b><em>آخرین خدمت</em></span>
                    <span><b>{clientProfile.lastBooking?.date || clientProfile.lastBooking?.booking_date || booking.date || "—"}</b><em>آخرین نوبت</em></span>
                  </div>
                  <div className="scheduleBookingClientInfo">
                    <span><b>تماس</b><em dir="ltr">{clientProfile.phone || "ثبت نشده"}</em></span>
                    <span><b>منطقه</b><em>{clientProfile.area || "ثبت نشده"}</em></span>
                  </div>
                  {clientProfile.bookings?.length ? (
                    <div className="scheduleBookingClientRail">
                      {clientProfile.bookings.slice(0, 3).map((item) => (
                        <article key={item.id || `${item.date}-${item.time}-${item.service}`}>
                          <b>{item.service || "خدمت"}</b>
                          <span>{item.date || item.booking_date || "—"} · {item.time || "—"}</span>
                          <em>{item.status || "رزرو"}</em>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="clientBookingSettingsActions scheduleBookingSettingsActions">
                <button
                  type="button"
                  onClick={() => {
                    if (phone) window.location.href = `tel:${toLatinDigits(phone)}`;
                  }}
                >
                  <Phone size={16} />
                  تماس
                </button>
              </div>
              {isPendingReview ? (
                <div className="scheduleBookingReviewActions">
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
              {isSalonOwner ? (
                <div className="scheduleBookingMiniActions">
                  <button type="button" disabled={actionDisabled} onClick={() => onViewChange?.("time")}>
                    <Timer size={15} />
                    تغییر ساعت
                  </button>
                  <button type="button" disabled={actionDisabled} onClick={() => onViewChange?.("staff")}>
                    <UserRound size={15} />
                    تغییر آرتیست
                  </button>
                  <button type="button" className="is-danger" disabled={actionDisabled} onClick={onCancel}>
                    <Trash2 size={15} />
                    {busy ? "در حال…" : "لغو"}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {view === "time" ? (
            <div className="scheduleBookingPickList">
              <button type="button" className="scheduleBookingBack" disabled={actionDisabled} onClick={() => onViewChange?.("menu")}>
                بازگشت
              </button>
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

          {view === "staff" ? (
            <div className="scheduleBookingPickList is-staff">
              <button type="button" className="scheduleBookingBack" disabled={actionDisabled} onClick={() => onViewChange?.("menu")}>
                بازگشت
              </button>
              {staffOptions.map((person) => {
                const personAvatar = person.avatar || person.staff_avatar || "";
                const active = person.name === booking.staff;
                return (
                  <button
                    type="button"
                    key={person.id || person.name}
                    className={active ? "is-selected" : ""}
                    disabled={actionDisabled}
                    onClick={() => onChangeStaff?.(person.name)}
                  >
                    <span className={`scheduleStaffAvatar ${personAvatar ? "hasImage" : ""}`} aria-hidden="true">
                      {personAvatar ? <img src={personAvatar} alt="" /> : String(person.artist_name || person.name || "آ").slice(0, 1)}
                    </span>
                    <span className="scheduleBookingStaffCopy">
                      <b>{person.artist_name || person.name}</b>
                      <small>{person.role || person.artist_service || "آرتیست"}{person.artist_area ? ` · ${person.artist_area}` : ""}</small>
                    </span>
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
