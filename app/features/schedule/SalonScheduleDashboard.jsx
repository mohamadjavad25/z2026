"use client";

import { Check, ChevronLeft, MoreHorizontal, X } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Mascot } from "../../components/Mascot";
import { SegmentClock } from "../../components/SegmentClock";
import { SkeletonList } from "../../components/Skeleton";
import { toPersianDigits } from "../../shared/lib/digits";
import { requestMinutesLeft } from "../../shared/lib/bookingWindow";
import { getBookingDateKey, isArtistBookingOnExactDate } from "../artist";
import { PendingOtherDays } from "./PendingOtherDays";
import { BookingWeekRail } from "../profile/BookingWeekRail";
import { ScheduleRow } from "../profile/ScheduleRow";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";
import { SalonDirectVisits } from "../salons/SalonDirectVisits";

/**
 * Salon owner overview — collab inbox + day schedule; a pending request is answered on its own card.
 * Presentational: lists + callbacks; schedule triad/memos stay in HomeApp.
 */
export function SalonScheduleDashboard({
  pendingCollabRequests = [],
  onApproveCollab,
  onDeclineCollab,
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
      {pendingCollabRequests.length > 0 && (
        <section className="salonCollabInbox" aria-label="پیشنهادهای همکاری آرتیست‌ها">
          <div className="boardHead">
            <div>
              <span>پیشنهاد همکاری</span>
              <strong>آرتیست‌هایی که می‌خوان با سالنت کار کنن</strong>
            </div>
            <b>{toPersianDigits(pendingCollabRequests.length)} تازه</b>
          </div>
          <div className="salonCollabInboxList">
            {pendingCollabRequests.map((request) => {
              const busy = String(requestBusyId) === `collab:${request.id}`;
              const anyBusy = Boolean(requestBusyId);
              return (
              <article className="salonCollabInboxCard" key={request.id}>
                <div className="salonCollabArtist">
                  <span className={`salonCollabAvatar ${request.artistAvatar ? "hasImage" : ""}`} aria-hidden="true">
                    {request.artistAvatar ? <img src={request.artistAvatar} alt="" /> : String(request.artistName || "آ").slice(0, 1)}
                  </span>
                  <div>
                    <strong>{request.artistName}</strong>
                    <small>{request.artistService || request.artistArea || "آرتیست frfro"}</small>
                  </div>
                </div>
                <div className="salonCollabDeal">
                  <b className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{shortServiceLabel(request.service)}</b>
                  <span>{request.days}</span>
                  <em>{request.from} تا {request.to}، {request.capacity} نفر در روز</em>
                </div>
                <div className="salonCollabSharePill">
                  <b>{request.share}٪</b>
                  <span>سهم آرتیست</span>
                </div>
                <div className="requestActions">
                  <button type="button" className="is-approve" disabled={anyBusy} onClick={() => onApproveCollab?.(request.id)}>
                    <Check size={15} />
                    {busy ? "…" : "تأیید"}
                  </button>
                  <button type="button" className="is-decline" disabled={anyBusy} onClick={() => onDeclineCollab?.(request.id)}>
                    <X size={15} />
                    رد
                  </button>
                </div>
              </article>
              );
            })}
          </div>
        </section>
      )}

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
          ) : dayAppointments.length > 0 ? dayAppointments.map((item, index) => (
            <ScheduleRow
              key={item.id != null ? String(item.id) : `salon-row-${item.time}-${item.client}-${index}`}
              booking={item}
              onOpenClient={onOpenClient}
              onAction={onOpenBookingMenu}
              review={reviewFor(item)}
            />
          )) : (
            <div className="salonTodayEmpty">
              <Mascot pose="free-day" size={140} />
              <b>«{emptyDayLabel}» نوبتی نداری؛ وقت یه چایی‌ه</b>
            </div>
          )}
        </div>
      </section>
      <SalonDirectVisits />
    </div>
  );
}
