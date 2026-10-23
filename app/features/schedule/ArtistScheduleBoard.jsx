"use client";

import { useState } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Mascot } from "../../components/Mascot";
import { ChevronLeft, Coffee, MoreHorizontal, Store } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { SkeletonList } from "../../components/Skeleton";
import { getBookingDateKey, isArtistBookingOnExactDate } from "../artist";
import { BookingHistoryCalendarSheet } from "../profile/BookingHistoryCalendarSheet";
import { DayNav, useDaySwipe } from "../profile/DayNav";
import { ScheduleRow } from "../profile/ScheduleRow";
import { PendingOtherDays } from "./PendingOtherDays";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

/**
 * Artist owner — bookings/schedule tab.
 * Presentational: day list + break banner; scheduleNow memo + menu open stay in HomeApp.
 */
export function ArtistScheduleBoard({
  breakTime = null,
  onOpenBreakEditor,
  weekTabs = [],
  selectedDay = "",
  onSelectDay,
  bookings = [],
  dayRows = [],
  dayLabel = "",
  loading = false,
  onOpenClient,
  onOpenBookingMenu,
  requests = [],
  requestBusyId = "",
  onApproveRequest,
  onDeclineRequest
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const daySwipe = useDaySwipe(weekTabs, selectedDay, onSelectDay);
  const requestsById = new Map(requests.map((request) => [String(request.id), request]));
  const reviewFor = (booking) => {
    const request = booking.id != null ? requestsById.get(String(booking.id)) : null;
    if (!request) return null;
    return {
      createdAt: request.createdAt,
      day: request.dateKey || request.date,
      time: request.time,
      waitMinutes: request.waitMinutes,
      busy: String(requestBusyId) === `booking:${request.id}`,
      disabled: Boolean(requestBusyId),
      onApprove: () => onApproveRequest?.(request.id),
      onDecline: () => onDeclineRequest?.(request.id)
    };
  };

  return (
    <div className="artistBookingsPage">
      <section className="salonTodaySchedule is-artistSchedule">
        <DayNav items={weekTabs} selectedDay={selectedDay} onSelectDay={onSelectDay} onOpenCalendar={() => setHistoryOpen(true)} />
        <PendingOtherDays
          requests={requests.map((request) => ({ id: request.id, dateKey: getBookingDateKey(request.dateKey || request.date) }))}
          visibleIds={dayRows.map((booking) => booking.id)}
          onSelectDay={onSelectDay}
        />
        <div className="todayScheduleList" {...daySwipe}>
          {loading ? (
            <SkeletonList rows={4} variant="row" className="artistScheduleSkeleton" label="در حال بارگذاری رزروهای آرتیست" />
          ) : dayRows.length > 0 ? dayRows.map((booking, index) => (
            <ScheduleRow
              key={booking.id != null ? String(booking.id) : `artist-row-${booking.time}-${booking.client}-${index}`}
              booking={booking}
              onOpenClient={onOpenClient}
              onAction={onOpenBookingMenu}
              review={reviewFor(booking)}
            />
          )) : (
            <div className="salonTodayEmpty">
              <Mascot pose="free-day" size={150} />
              <b>برای «{dayLabel}» رزروی ثبت نشده</b>
            </div>
          )}
        </div>
        <div className="artistBookingsToolbar">
          <button
            type="button"
            className={`artistBreakBtn ${breakTime ? "is-active" : ""}`}
            onClick={onOpenBreakEditor}
          >
            <Coffee size={15} />
            تایم استراحت
          </button>
        </div>
        {breakTime ? (
          <div className="artistBreakBanner">
            <Coffee size={15} />
            <span>
              استراحت روزانه: <b>از {breakTime.start}</b> تا <b>{breakTime.end}</b>
            </span>
            <button type="button" onClick={onOpenBreakEditor}>ویرایش</button>
          </div>
        ) : null}
      </section>

      <BookingHistoryCalendarSheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        selectedDay={selectedDay}
        onSelectDay={onSelectDay}
        bookings={bookings}
        matchBookingDay={(booking, dateKey) => isArtistBookingOnExactDate(booking, dateKey)}
        kicker="رزرو"
        title="تاریخچه رزروها"
        emptyDayLabel="رزروی ثبت نشده"
        renderBooking={(booking, { closeHistory }) => {
          const sourceSalon = booking.sourceSalon;
          const sourceSalonAvatar = sourceSalon?.avatar || "";
          return (
            <article className="todayScheduleRow bookingWeekHistoryRow">
              <button
                type="button"
                className="scheduleMeta"
                onClick={() => {
                  closeHistory?.();
                  onOpenClient?.(booking);
                }}
                aria-label={`پروفایل ${booking.client}`}
              >
                <span className={`scheduleClientAvatar ${booking.clientAvatar ? "hasImage" : ""}`} aria-hidden="true">
                  {booking.clientAvatar ? <img src={booking.clientAvatar} alt="" /> : String(booking.client || "م").slice(0, 1)}
                </span>
                <div className="scheduleMetaCopy">
                  <b>{booking.client}</b>
                  <span>
                    <ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" className="svcInlineIcon" />
                    {shortServiceLabel(booking.service) || "خدمت"}
                    <i aria-hidden="true">•</i>
                    {booking.date || "امروز"}
                  </span>
                  {booking.phone ? <em dir="ltr">{booking.phone}</em> : null}
                </div>
                <ChevronLeft size={16} className="scheduleMetaGo" aria-hidden="true" />
              </button>
              <div className="scheduleTimeWrap">
                <SegmentClock value={booking.time} size="xs" backgroundColor="transparent" />
              </div>
              <div className="scheduleStaffCol">
                <button
                  type="button"
                  className="scheduleBookingMore"
                  aria-label={`تنظیمات رزرو ${booking.client}`}
                  title="تنظیمات رزرو"
                  onClick={() => {
                    closeHistory?.();
                    onOpenBookingMenu?.(booking);
                  }}
                >
                  <MoreHorizontal size={18} />
                </button>
                <div className="scheduleStaff">
                  <span className={`scheduleStaffAvatar ${sourceSalonAvatar ? "hasImage" : ""}`} aria-hidden="true">
                    {sourceSalonAvatar ? <img src={sourceSalonAvatar} alt="" /> : (sourceSalon ? <Store size={14} /> : String(booking.client || "م").slice(0, 1))}
                  </span>
                  <small>{sourceSalon?.name || "شخصی"}</small>
                </div>
              </div>
            </article>
          );
        }}
      />
    </div>
  );
}
