"use client";

import { memo } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { MoreHorizontal, Store } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import {
  getArtistClientVisits,
  getBookingTimelineLabel,
  getBookingTimelinePhase,
  resolveBookingDurationMinutes
} from "../artist/bookingUtils";

// Status-tone mapping, ownerType-aware — NOT a plain copy of
// ClientBookingSettingsModal.jsx's getBookingStatusTone, because "تازه"
// means two different things depending on who owns the booking:
// - salon_bookings: "تازه" is written when the SALON itself enters a
//   walk-in/appointment (useSalonWorkspace.js addSalonAppointment) — already
//   settled, no one needs to respond to it. Only "درخواست" (a client's own
//   self-book request, useSalonDirectory.js) is genuinely pending on the
//   salon; see useSalonWorkspace.js's reservationRequestList, which filters
//   on "درخواست" only, never "تازه".
// - artist_bookings (direct): "تازه" IS the pending-on-artist default (see
//   useArtistWorkspace.js / HomeApp.jsx's pendingArtistBookingRequests,
//   which treats "تازه" as not-yet-reviewed); "درخواست" doesn't occur here.
// "done" means "salon/artist actually confirmed it" — used below only to
// decide whether the row's time-phase tag (upcoming/live/done) is
// trustworthy to show, or whether the booking's real approval status needs
// to override it.
function getBookingStatusTone(status = "", ownerType = "salon") {
  if (status === "تایید" || status === "تایید شده") return "done";
  if (status === "لغو") return "bad";
  if (status === "منقضی شده") return "expired";
  if (status === "درخواست") return "pending";
  if (status === "تازه") return ownerType === "artist" ? "pending" : "done";
  return "pending";
}

export function buildSalonStaffByName(staffList = []) {
  const map = new Map();
  for (const person of staffList) {
    const name = String(person?.name || "").trim();
    if (name) map.set(name, person);
  }
  return map;
}

export function normalizeSalonScheduleBooking(item, staffByName, serviceList = []) {
  const staffName = String(item?.staff || "").trim();
  const staffPerson = staffByName?.get?.(staffName) || null;
  const client = String(item?.client || "").trim();
  const rawDate = item?.booking_date || item?.date || "";
  const date = rawDate ? formatRelativeBookingDayLabel(rawDate) : "نامشخص";
  const visits = getArtistClientVisits(item);

  return {
    id: item?.id ?? null,
    ownerType: "salon",
    client,
    clientInitial: (client || "م").slice(0, 1),
    clientAvatar: item?.clientAvatar || item?.client_avatar || "",
    phone: String(item?.phone || "").trim(),
    service: item?.service || "خدمت",
    serviceEmoji: item?.service_emoji || "",
    date,
    time: item?.time || "",
    staff: staffName,
    staffLabel: staffPerson?.artist_name || staffName,
    staffAvatar: item?.staffAvatar || item?.staff_avatar || staffPerson?.avatar || staffPerson?.staff_avatar || "",
    staffInitial: String(staffPerson?.artist_name || staffName || "آ").trim().slice(0, 1) || "آ",
    visits,
    visitCount: visits.filter((level) => level > 0).length,
    durationMinutes: resolveBookingDurationMinutes(item, serviceList),
    source: item
  };
}

export function normalizeArtistScheduleBooking(booking, serviceList = []) {
  const client = String(booking?.client || "").trim();
  const rawDate = booking?.date || booking?.booking_date || "";
  const date = rawDate ? formatRelativeBookingDayLabel(rawDate) : "نامشخص";
  const sourceSalon = booking?.sourceSalon || null;
  const sourceSalonAvatar = sourceSalon?.avatar || "";
  const visits = getArtistClientVisits(booking);

  return {
    id: booking?.id ?? null,
    ownerType: "artist",
    client,
    clientInitial: (client || "م").trim().slice(0, 1) || "م",
    clientAvatar: booking?.clientAvatar || booking?.client_avatar || "",
    phone: String(booking?.phone || "").trim(),
    service: booking?.service || "خدمت",
    serviceEmoji: booking?.service_emoji || "",
    date,
    time: booking?.time || "",
    staff: "",
    staffLabel: sourceSalon?.name || "شخصی",
    staffAvatar: sourceSalonAvatar,
    staffInitial: (sourceSalon?.name || client || "م").trim().slice(0, 1) || "م",
    sourceSalon,
    visits,
    visitCount: visits.filter((level) => level > 0).length,
    durationMinutes: resolveBookingDurationMinutes(booking, serviceList),
    source: booking
  };
}

export function withScheduleTimeline(booking, { selectedDay, now }) {
  const phase = getBookingTimelinePhase(
    { date: booking.date, time: booking.time },
    {
      selectedDay,
      now,
      durationMinutes: booking.durationMinutes
    }
  );
  return {
    ...booking,
    phase,
    phaseLabel: getBookingTimelineLabel(phase)
  };
}

function scheduleRowPropsAreEqual(prev, next) {
  return (
    prev.booking?.id === next.booking?.id
    && prev.booking?.phase === next.booking?.phase
    && prev.booking?.phaseLabel === next.booking?.phaseLabel
    && prev.booking?.client === next.booking?.client
    && prev.booking?.clientAvatar === next.booking?.clientAvatar
    && prev.booking?.phone === next.booking?.phone
    && prev.booking?.service === next.booking?.service
    && prev.booking?.serviceEmoji === next.booking?.serviceEmoji
    && prev.booking?.date === next.booking?.date
    && prev.booking?.time === next.booking?.time
    && prev.booking?.staffLabel === next.booking?.staffLabel
    && prev.booking?.staffAvatar === next.booking?.staffAvatar
    && prev.booking?.visitCount === next.booking?.visitCount
    && prev.booking?.source?.status === next.booking?.source?.status
    && prev.variant === next.variant
    && prev.booking?.displayTitle === next.booking?.displayTitle
    && prev.booking?.displayMeta === next.booking?.displayMeta
  );
}

export const ScheduleRow = memo(function ScheduleRow({
  booking,
  onOpenClient,
  onAction,
  variant = "default"
}) {
  const {
    phase,
    phaseLabel,
    client,
    clientInitial,
    clientAvatar,
    phone,
    service,
    date,
    time,
    staffLabel,
    staffAvatar,
    staffInitial,
    sourceSalon,
    visits,
    visitCount
  } = booking;

  const isClientBooking = variant === "client";
  const actionPayload = booking.source ? { ...booking.source, ...booking } : booking;
  const title = booking.displayTitle || client;
  const meta = booking.displayMeta || service;

  // The time-phase tag (upcoming/live/done) only means something for a
  // booking the salon/artist actually confirmed — for one still awaiting a
  // response, declined, or auto-expired, showing "در حال انجام"/"انجام شد"
  // as if it were a real appointment is actively misleading. Override the
  // tag with the real approval status in those 3 cases; leave confirmed
  // bookings showing the useful time-phase info as before.
  const rawStatus = booking.source?.status || "";
  const statusTone = getBookingStatusTone(rawStatus, booking.ownerType);
  const showStatusTag = statusTone !== "done";
  const phaseTagClass = showStatusTag ? `is-status-${statusTone}` : `is-${phase}`;
  const phaseTagLabel = showStatusTag ? (rawStatus || "درخواست") : phaseLabel;

  return (
    <article
      className={`todayScheduleRow is-${phase || "upcoming"} ${isClientBooking ? "is-clientBookingRow" : ""}`.trim()}
      data-phase={phase}
    >
      <div
        className="scheduleMeta"
        aria-label={`${title}، ${meta}، ${date}`}
      >
        <span className={`scheduleClientAvatar ${clientAvatar ? "hasImage" : ""}`} aria-hidden="true">
          {clientAvatar ? <img src={clientAvatar} alt="" /> : clientInitial}
        </span>
        <div className="scheduleMetaCopy">
          <b>{title}</b>
          <span>
            <ServiceIcon emoji={booking.serviceEmoji} name={service} size="xs" className="svcInlineIcon" />
            {meta}
            <i aria-hidden="true">•</i>
            {date}
          </span>
          {!isClientBooking ? (
            <div className="artistVisitRow" aria-label={`${toPersianDigits(visitCount)} رزرو این مشتری`}>
              <div className="artistVisitGrid" title={`${toPersianDigits(visitCount)} از ۱۰`}>
                {visits.map((level, index) => (
                  <i
                    key={`${booking.id ?? `${time}-${client}`}-visit-${index}`}
                    className={`is-l${level}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="scheduleTimeWrap">
        <SegmentClock value={time} size="xs" backgroundColor="transparent" />
        {!isClientBooking ? <small className={`schedulePhaseTag ${phaseTagClass}`}>{phaseTagLabel}</small> : null}
      </div>
      <div className="scheduleStaffCol">
        <button
          type="button"
          className="scheduleBookingMore"
          aria-label={`مدیریت رزرو ${client}`}
          title="گزینه‌های رزرو"
          onClick={() => onAction?.(actionPayload)}
        >
          <MoreHorizontal size={18} />
        </button>
        {!isClientBooking ? <div className="scheduleStaff">
          <span className={`scheduleStaffAvatar ${staffAvatar ? "hasImage" : ""}`} aria-hidden="true">
            {staffAvatar ? (
              <img src={staffAvatar} alt="" />
            ) : sourceSalon && !staffAvatar ? (
              <Store size={14} />
            ) : (
              staffInitial
            )}
          </span>
          <small>{staffLabel}</small>
        </div> : null}
      </div>
    </article>
  );
}, scheduleRowPropsAreEqual);
