"use client";

import { memo } from "react";
import { MessageCircle, MoreHorizontal, Store } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import {
  getArtistClientVisits,
  getBookingTimelineLabel,
  getBookingTimelinePhase,
  resolveBookingDurationMinutes
} from "../artist/bookingUtils";

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
    && prev.booking?.date === next.booking?.date
    && prev.booking?.time === next.booking?.time
    && prev.booking?.staffLabel === next.booking?.staffLabel
    && prev.booking?.staffAvatar === next.booking?.staffAvatar
    && prev.booking?.visitCount === next.booking?.visitCount
    && prev.actionKind === next.actionKind
    && prev.variant === next.variant
    && prev.booking?.displayTitle === next.booking?.displayTitle
    && prev.booking?.displayMeta === next.booking?.displayMeta
  );
}

export const ScheduleRow = memo(function ScheduleRow({
  booking,
  onOpenClient,
  onAction,
  actionKind = "more",
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
  const ActionIcon = actionKind === "message" ? MessageCircle : MoreHorizontal;
  const actionPayload = booking.source ? { ...booking.source, ...booking } : booking;
  const title = booking.displayTitle || client;
  const meta = booking.displayMeta || service;

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
        {!isClientBooking ? <small className={`schedulePhaseTag is-${phase}`}>{phaseLabel}</small> : null}
      </div>
      <div className="scheduleStaffCol">
        <button
          type="button"
          className="scheduleBookingMore"
          aria-label={actionKind === "message" ? `پیام به ${client}` : `مدیریت رزرو ${client}`}
          title={actionKind === "message" ? "پیام" : "گزینه‌های رزرو"}
          onClick={() => onAction?.(actionPayload)}
        >
          <ActionIcon size={18} />
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
