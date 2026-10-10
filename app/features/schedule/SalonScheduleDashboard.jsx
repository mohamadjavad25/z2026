"use client";

import { AlarmClock, Check, ChevronLeft, MoreHorizontal, X } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Mascot } from "../../components/Mascot";
import { SegmentClock } from "../../components/SegmentClock";
import { SkeletonList } from "../../components/Skeleton";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRequestExpiryDeadline, getRequestExpiryMinutesLeft } from "../../shared/lib/time";
import { getBookingDateKey, isArtistBookingOnExactDate } from "../artist";

/** A pending request the owner hasn't answered yet has, at most, 60 minutes
 *  before the auto-expiry sweep drops it -- previously nothing on this
 *  card said so, and the only trace was a read-only "expired" line seen
 *  after the fact. */
function RequestExpiryBadge({ createdAt }) {
  const minutesLeft = getRequestExpiryMinutesLeft(createdAt);
  if (minutesLeft === null) return null;
  const deadline = formatRequestExpiryDeadline(createdAt);
  if (!deadline) return null;
  const urgent = minutesLeft <= 15;
  return (
    <span className={`requestExpiryBadge ${urgent ? "is-urgent" : ""}`}>
      <AlarmClock size={12} aria-hidden="true" />
      {minutesLeft > 0 ? `تا ساعت ${deadline} تایید کن` : "زمان تایید تمام شده"}
    </span>
  );
}
import { BookingWeekRail } from "../profile/BookingWeekRail";
import { ScheduleRow } from "../profile/ScheduleRow";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

/**
 * Salon owner overview — collab inbox + reservation requests + day schedule.
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
  return (
    <div className="salonDashboard">
      {pendingCollabRequests.length > 0 && (
        <section className="salonCollabInbox" aria-label="پیشنهادهای همکاری آرتیست‌ها">
          <div className="boardHead">
            <div>
              <span>پیشنهاد همکاری</span>
              <strong>آرتیست‌ها برای سالن شما</strong>
            </div>
            <b>{toPersianDigits(pendingCollabRequests.length)} جدید</b>
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
                  <em>{request.from} تا {request.to} • {request.capacity} نفر در روز</em>
                </div>
                <div className="salonCollabSharePill">
                  <b>{request.share}٪</b>
                  <span>سهم آرتیست</span>
                </div>
                <div className="requestActions">
                  <button type="button" className="is-approve" disabled={anyBusy} onClick={() => onApproveCollab?.(request.id)}>
                    <Check size={15} />
                    {busy ? "…" : "تایید"}
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

      {reservationRequests.length > 0 && (
        <section className="salonRequestsBoard" aria-label="درخواست‌های آینده">
          <div className="boardHead">
            <div>
              <span>درخواست‌های آینده</span>
              <strong>نیاز به تایید شما</strong>
            </div>
            <b>{reservationRequests.length} درخواست</b>
          </div>
          <div className="reservationRequestList">
            {reservationRequests.map((request) => {
              const busy = String(requestBusyId) === `reservation:${request.id}`;
              const anyBusy = Boolean(requestBusyId);
              return (
              <article className="reservationRequestCard" key={request.id}>
                <div className="requestCardMain">
                  <div className="requestCardWho">
                    <strong>{request.client}</strong>
                    <span className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{shortServiceLabel(request.service)}</span>
                    <small>
                      <b>{request.staff}</b>
                      <em>مسئول</em>
                      <i aria-hidden="true" />
                      {request.note}
                    </small>
                  </div>
                  <div className="requestCardAside">
                    <b className="requestTime" dir="ltr">{toPersianDigits(String(request.time || ""))}</b>
                    <div className="requestCardWhen">
                      <em>{request.day}</em>
                      <span>{request.date}</span>
                    </div>
                  </div>
                </div>
                <RequestExpiryBadge createdAt={request.createdAt} />
                <div className="requestActions">
                  <button
                    type="button"
                    className="is-approve"
                    disabled={anyBusy || (getRequestExpiryMinutesLeft(request.createdAt) ?? 1) <= 0}
                    onClick={() => onApproveRequest?.(request.id, { bookingDateForSlots })}
                  >
                    <Check size={15} />
                    {busy ? "…" : "تایید"}
                  </button>
                  <button type="button" className="is-decline" disabled={anyBusy} onClick={() => onDeclineRequest?.(request.id)}>
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
          tabLabel="تاریخچه"
          modalTitle="تاریخچه رزروها"
          emptyDayLabel="رزروی ثبت نشده"
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
                    aria-label={`مدیریت رزرو ${item.client}`}
                    title="گزینه‌های رزرو"
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
        <div className="todayScheduleList">
          {loading ? (
            <SkeletonList rows={4} variant="row" className="salonScheduleSkeleton" label="در حال بارگذاری برنامه سالن" />
          ) : dayAppointments.length > 0 ? dayAppointments.map((item, index) => (
            <ScheduleRow
              key={item.id != null ? String(item.id) : `salon-row-${item.time}-${item.client}-${index}`}
              booking={item}
              onOpenClient={onOpenClient}
              onAction={onOpenBookingMenu}
            />
          )) : (
            <div className="salonTodayEmpty">
              <Mascot pose="hairdryer" size={140} />
              <b>برای «{emptyDayLabel}» رزروی ثبت نشده</b>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
