"use client";

import { memo } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { MoreHorizontal, Store } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { scheduleBookingParts } from "../../shared/lib/bookingParts";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import {
  getArtistClientVisits,
  getBookingTimelineLabel,
  getBookingTimelinePhase,
  resolveBookingDurationMinutes
} from "../artist/bookingUtils";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

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
  // A multi-service booking: how many services, who does them, and when the visit ends.
  const parts = scheduleBookingParts(item?.time, item?.parts);
  const multiPart = parts.length >= 2;
  const partStaff = multiPart
    ? [...new Set(parts.map((part) => part.staff).filter(Boolean))].map((name) => {
        const person = staffByName?.get?.(name) || null;
        const label = person?.artist_name || name;
        return { name, label, avatar: person?.avatar || person?.staff_avatar || "", initial: label.slice(0, 1) };
      })
    : [];

  return {
    id: item?.id ?? null,
    ownerType: "salon",
    partCount: multiPart ? parts.length : 0,
    partStaff,
    endTime: multiPart ? parts[parts.length - 1].endLabel : "",
    client,
    clientInitial: (client || "م").slice(0, 1),
    clientAvatar: item?.clientAvatar || item?.client_avatar || "",
    phone: String(item?.phone || "").trim(),
    service: item?.service || "خدمت",
    serviceEmoji: item?.service_emoji || "",
    date,
    time: item?.time || "",
    staff: staffName,
    staffLabel: multiPart
      ? (partStaff.length ? partStaff.map((person) => person.label).join(" و ") : "آرتیست ثبت نشده")
      : staffPerson?.artist_name || staffName,
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
    { date: booking.date, dateKey: booking.source?.booking_date || booking.source?.date, time: booking.time },
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
    && prev.booking?.source?.parts === next.booking?.source?.parts
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
  const meta = booking.displayMeta || shortServiceLabel(service);

  // The time-phase tag (upcoming/live/done) only means something for a
  // booking the salon/artist actually confirmed — for one still awaiting a
  // response, declined, or auto-expired, showing "در حال انجام"/"انجام شد"
  // as if it were a real appointment is actively misleading. Override the
  // tag with the real approval status in those 3 cases; leave confirmed
  // bookings showing the useful time-phase info as before.
  const rawStatus = booking.source?.status || "";
  let statusTone = getBookingStatusTone(rawStatus, booking.ownerType);
  // A request nobody answered before its time is over, even if the server's sweep hasn't marked it yet.
  const unansweredAndOver = statusTone === "pending" && (phase === "done" || phase === "live");
  if (unansweredAndOver) statusTone = "expired";
  const showStatusTag = statusTone !== "done";
  const phaseTagClass = showStatusTag ? `is-status-${statusTone}` : `is-${phase}`;
  const statusText = isClientBooking && rawStatus === AWAITING_CLIENT ? "در انتظار تو" : rawStatus;
  const phaseTagLabel = unansweredAndOver ? "منقضی شد" : showStatusTag ? (statusText || "درخواست") : phaseLabel;

  const chipClass = showStatusTag ? `is-status-${statusTone}` : `is-${phase || "upcoming"}`;

  return (
    <div
      className={`bkRow is-${phase || "upcoming"}${showStatusTag ? ` is-tone-${statusTone}` : ""}${isClientBooking ? " is-client" : ""}`}
      data-phase={phase}
      role="button"
      tabIndex={0}
      aria-label={`مدیریت رزرو ${title}، ${meta}، ${date}، ${time}`}
      onClick={() => onAction?.(actionPayload)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAction?.(actionPayload);
        }
      }}
    >
      {booking.partCount ? (
        <span className="bkIconStack">
          <ServiceIcon emoji={booking.serviceEmoji} name={service} size="md" className="bkIcon" />
          <span className="bkCount" aria-label={`${toPersianDigits(booking.partCount)} خدمت`}>{toPersianDigits(booking.partCount)}</span>
        </span>
      ) : (
        <ServiceIcon emoji={booking.serviceEmoji} name={service} size="md" className="bkIcon" />
      )}

      <div className="bkBody">
        <div className="bkTitle">
          {!isClientBooking ? (
            <img className="bkAvatar" src={clientAvatar || "/profile-icon.svg"} alt="" aria-hidden="true" draggable={false} />
          ) : null}
          <b>{title}</b>
          {!isClientBooking || showStatusTag ? <span className={`bkChip ${chipClass}`}>{phaseTagLabel}</span> : null}
        </div>
        <div className="bkMeta">
          <span>{meta}</span>
          <i aria-hidden="true" />
          <span>{date}</span>
        </div>
        {!isClientBooking ? (
          <div className="bkFoot">
            <span className="bkWho">
              {booking.partStaff?.length > 1 ? (
                <span className="bkWhoStack" aria-hidden="true">
                  {booking.partStaff.slice(0, 3).map((person) => (
                    <span className={`bkWhoAvatar ${person.avatar ? "hasImage" : ""}`} key={person.name}>
                      {person.avatar ? <img src={person.avatar} alt="" /> : person.initial}
                    </span>
                  ))}
                </span>
              ) : (
              <span className={`bkWhoAvatar ${(booking.partStaff?.[0]?.avatar || staffAvatar) ? "hasImage" : ""}`} aria-hidden="true">
                {(booking.partStaff?.[0]?.avatar || staffAvatar) ? (
                  <img src={booking.partStaff?.[0]?.avatar || staffAvatar} alt="" />
                ) : sourceSalon ? (
                  <Store size={12} />
                ) : (
                  booking.partStaff?.[0]?.initial || staffInitial
                )}
              </span>
              )}
              {staffLabel}
            </span>
            <span className="bkVisits" aria-label={`${toPersianDigits(visitCount)} رزرو این مشتری`} title={`${toPersianDigits(visitCount)} از ۱۰`}>
              {visits.map((level, index) => (
                <i key={`${booking.id ?? `${time}-${client}`}-visit-${index}`} className={`is-l${level}`} aria-hidden="true" />
              ))}
            </span>
          </div>
        ) : null}
      </div>

      <div className="bkSide">
        <div className="bkTime">
          <SegmentClock value={time} size="xs" backgroundColor="transparent" />
        </div>
        {booking.endTime ? <small className="bkEnd">تا {toPersianDigits(booking.endTime)}</small> : null}
        <span className="bkMore" aria-hidden="true">
          <MoreHorizontal size={18} />
        </span>
      </div>
    </div>
  );
}, scheduleRowPropsAreEqual);
