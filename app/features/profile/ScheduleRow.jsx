"use client";

import { memo } from "react";
import { Check, Store, X } from "lucide-react";
import { RequestExpiryBadge } from "../schedule/RequestExpiryBadge";
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

function addMinutesToLabel(label, minutes) {
  const match = String(label || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatDurationShort(minutes) {
  if (!minutes) return "";
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${toPersianDigits(hours)}:${toPersianDigits(String(rest).padStart(2, "0"))} ساعت` : `${toPersianDigits(hours)} ساعت`;
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
    && prev.review === next.review
    && prev.booking?.displayTitle === next.booking?.displayTitle
    && prev.booking?.displayMeta === next.booking?.displayMeta
    && prev.booking?.source?.parts === next.booking?.source?.parts
    && prev.booking?.durationMinutes === next.booking?.durationMinutes
  );
}

export const ScheduleRow = memo(function ScheduleRow({
  booking,
  onOpenClient,
  onAction,
  variant = "default",
  review = null
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
    sourceSalon
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
  // A salon's booking given to an artist waits on the salon, not on them.
  const waitsOnSalon = booking.ownerType === "artist" && sourceSalon && statusTone === "pending";
  const statusText = isClientBooking && rawStatus === AWAITING_CLIENT
    ? "در انتظار تو"
    : waitsOnSalon ? "منتظر سالن" : rawStatus;
  const phaseTagLabel = unansweredAndOver ? "منقضی شد" : showStatusTag ? (statusText || "درخواست") : phaseLabel;

  // The time column: start, a rail as long as the visit, end, and how long it takes.
  const durationMinutes = Number(booking.durationMinutes) || 0;
  const endTime = booking.endTime || (durationMinutes ? addMinutesToLabel(time, durationMinutes) : "");
  const railHeight = Math.round(Math.min(44, Math.max(12, durationMinutes / 4)));
  const durationLabel = formatDurationShort(durationMinutes);
  const showDate = date && date !== "امروز";

  const chipClass = showStatusTag ? `is-status-${statusTone}` : `is-${phase || "upcoming"}`;

  const row = (
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
          {showDate ? (
            <>
              <i aria-hidden="true" />
              <span>{date}</span>
            </>
          ) : null}
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
          </div>
        ) : null}
      </div>

      <div className="bkSide">
        <SegmentClock value={time} size="xs" className="bkStart" backgroundColor="transparent" />
        {endTime ? (
          <>
            <span className="bkRail" style={{ height: `${railHeight}px` }} aria-hidden="true" />
            <SegmentClock value={endTime} size="xxs" className="bkEnd" color="#6f7380" backgroundColor="transparent" />
            <small className="bkDuration">{durationLabel}</small>
          </>
        ) : null}
      </div>
    </div>
  );

  // A request waiting on this owner: answer it right on the card; tapping the card still opens its details.
  if (!review) return row;
  return (
    <div className="bkGroup">
      {row}
      <div className="bkReview">
        <RequestExpiryBadge createdAt={review.createdAt} />
        <div className="bkReviewActions">
          <button type="button" className="is-approve" disabled={review.disabled || review.approveDisabled} onClick={review.onApprove}>
            <Check size={15} aria-hidden="true" />
            {review.busy ? "…" : "تایید"}
          </button>
          <button type="button" className="is-decline" disabled={review.disabled} onClick={review.onDecline}>
            <X size={15} aria-hidden="true" />
            رد
          </button>
        </div>
      </div>
    </div>
  );
}, scheduleRowPropsAreEqual);
