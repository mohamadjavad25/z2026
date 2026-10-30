"use client";

import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Mascot } from "../../components/Mascot";
import { SegmentClock } from "../../components/SegmentClock";
import { SkeletonList } from "../../components/Skeleton";
import { requestMinutesLeft } from "../../shared/lib/bookingWindow";
import { getBookingDateKey, isArtistBookingOnExactDate } from "../artist";
import { PendingOtherDays } from "./PendingOtherDays";
import { BookingWeekRail } from "../profile/BookingWeekRail";
import { ScheduleRow } from "../profile/ScheduleRow";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";
import { TeamBusyRow, TeamVisitRow, useTeamClientTimes } from "../salons/SalonDirectVisits";
import { timeLabelToMinutes } from "../../shared/lib/time";

/**
 * Salon owner overview — the day schedule; a pending booking request is answered on its own row. Artists asking to
 * join are in «پرسنل» (SalonCollabInbox), not here (2026-10-30).
 * Presentational: lists + callbacks; schedule triad/memos stay in HomeApp.
 */
export function SalonScheduleDashboard({
  reservationRequests = [],
  bookingDateForSlots = "",
  onApproveRequest,
  onDeclineRequest,
  weekTabs = [],
  selectedDay = "",
  onSelectDay,
  historyBookings = [],
  dayAppointments = [],
  emptyDayLabel = "",
  staffList = [],
  loading = false,
  onOpenClient,
  onOpenBookingMenu,
  historyOpen,
  onHistoryOpenChange,
  requestBusyId = ""
}) {
  // The team's own clients that day (owner's decision of 2026-10-25): received here (violet) or elsewhere (striped),
  // placed among the salon's own bookings by time.
  const teamTimes = useTeamClientTimes();
  const dayKey = getBookingDateKey(selectedDay);
  const dayRows = [
    ...dayAppointments.map((item, index) => ({ kind: "own", item, index, at: timeLabelToMinutes(item.time) })),
    ...teamTimes.visits.filter((visit) => visit.date === dayKey).map((item) => ({ kind: "visit", item, at: timeLabelToMinutes(item.time) })),
    ...teamTimes.busy.filter((busy) => busy.date === dayKey).map((item) => ({ kind: "busy", item, at: timeLabelToMinutes(item.time) }))
  ].sort((a, b) => a.at - b.at);
  const requestsById = new Map(reservationRequests.map((request) => [String(request.id), request]));
  const reviewFor = (item) => {
    const request = item.id != null ? requestsById.get(String(item.id)) : null;
    if (!request) return null;
    return {
      createdAt: request.createdAt,
      day: request.date,
      time: request.time,
      waitMinutes: request.waitMinutes,
      busy: String(requestBusyId) === `reservation:${request.id}`,
      disabled: Boolean(requestBusyId),
      approveDisabled: (requestMinutesLeft(request.createdAt, request.date, request.time, { windowMinutes: request.waitMinutes }) ?? 1) <= 0,
      onApprove: () => onApproveRequest?.(request.id, { bookingDateForSlots }),
      onDecline: () => onDeclineRequest?.(request.id)
    };
  };

  return (
    <div className="salonDashboard">
      <section className="salonTodaySchedule">
        <BookingWeekRail
          tabs={weekTabs}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
          historyOpen={historyOpen}
          onHistoryOpenChange={onHistoryOpenChange}
          bookings={historyBookings}
          matchBookingDay={(booking, day, dateKey) => isArtistBookingOnExactDate(
            booking,
            dateKey || getBookingDateKey(day)
          )}
          getDayCount={(day, dateKey) => historyBookings.filter((booking) => (
            isArtistBookingOnExactDate(
              booking,
              dateKey || getBookingDateKey(day)
            )
          )).length}
          tabLabel="تقویم"
          modalTitle="تقویم نوبت‌ها"
          emptyDayLabel="نوبتی نیست"
          renderBooking={(item, { closeHistory }) => {
            const clientAvatar = item.clientAvatar || item.client_avatar || "";
            const staffPerson = staffList.find((person) => person.name === item.staff);
            const staffAvatar = item.staffAvatar || item.staff_avatar || staffPerson?.avatar || staffPerson?.staff_avatar || "";
            return (
              <article className="todayScheduleRow bookingWeekHistoryRow">
                <button
                  type="button"
                  className="scheduleMeta"
                  onClick={() => {
                    closeHistory?.();
                    onOpenClient?.(item);
                  }}
                  aria-label={`پروفایل ${item.client}`}
                >
                  <span className={`scheduleClientAvatar ${clientAvatar ? "hasImage" : ""}`} aria-hidden="true">
                    {clientAvatar ? <img src={clientAvatar} alt="" /> : String(item.client || "م").slice(0, 1)}
                  </span>
                  <div className="scheduleMetaCopy">
                    <b>{item.client}</b>
                    <span>
                      <ServiceIcon emoji={item.service_emoji} name={item.service} size="xs" className="svcInlineIcon" />
                      {shortServiceLabel(item.service) || "خدمت"}
                      <i aria-hidden="true">•</i>
                      {item.booking_date || item.date || "امروز"}
                    </span>
                    {item.phone ? <em dir="ltr">{item.phone}</em> : null}
                  </div>
                  <ChevronLeft size={16} className="scheduleMetaGo" aria-hidden="true" />
                </button>
                <div className="scheduleTimeWrap">
                  <SegmentClock value={item.time} size="xs" backgroundColor="transparent" />
                </div>
                <div className="scheduleStaffCol">
                  <button
                    type="button"
                    className="scheduleBookingMore"
                    aria-label={`نوبت ${item.client}`}
                    title="جزئیات نوبت"
                    onClick={() => {
                      closeHistory?.();
                      onOpenBookingMenu?.(item);
                    }}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  <div className="scheduleStaff">
                    <span className={`scheduleStaffAvatar ${staffAvatar ? "hasImage" : ""}`} aria-hidden="true">
                      {staffAvatar ? <img src={staffAvatar} alt="" /> : String(staffPerson?.artist_name || item.staff || "آ").slice(0, 1)}
                    </span>
                    <small>{staffPerson?.artist_name || item.staff}</small>
                  </div>
                </div>
              </article>
            );
          }}
        />
        <PendingOtherDays
          requests={reservationRequests.map((request) => ({ id: request.id, dateKey: getBookingDateKey(request.date) }))}
          visibleIds={dayAppointments.map((item) => item.id)}
          onSelectDay={onSelectDay}
        />
        <div className="todayScheduleList">
          {loading ? (
            <SkeletonList rows={4} variant="row" className="salonScheduleSkeleton" label="دارم برنامهٔ سالن رو میارم" />
          ) : dayRows.length > 0 ? dayRows.map((row) => (
            row.kind === "visit" ? <TeamVisitRow key={`team-visit-${row.item.id}`} visit={row.item} />
              : row.kind === "busy" ? <TeamBusyRow key={`team-busy-${row.item.id}`} item={row.item} />
                : (
                  <ScheduleRow
                    key={row.item.id != null ? String(row.item.id) : `salon-row-${row.item.time}-${row.item.client}-${row.index}`}
                    booking={row.item}
                    onOpenClient={onOpenClient}
                    onAction={onOpenBookingMenu}
                    review={reviewFor(row.item)}
                  />
                )
          )) : (
            <div className="salonTodayEmpty">
              <Mascot pose="free-day" size={140} />
              <b>«{emptyDayLabel}» نوبتی نداری؛ وقت یه چایی‌ه</b>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
